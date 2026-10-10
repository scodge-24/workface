import type { On, PromptSubmitInput, SessionCompactInput } from 'claude-code'
import type { Engine, MockClock } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/t'
const WF = '/home/t/.claude/workface/demo/workface.md'
const MARKER = '/home/t/.claude/workface/sessions/sid-1'
const MIN = 60_000

// An attached workface; the bottom answers for every model request, prompt and compaction, and records the last two.
// It stands for the engine: a /compact run compacts through every plugin's session.compact hook, as a typed one does.
function world($: Engine, on: On) {
  const files: Record<string, string> = { [MARKER]: `${WF}\n`, [WF]: '# demo — workface\n- HEAD: abc1234\n' }
  mock.env(on, { HOME })
  mock.store(on)
  const clock = mock.clock(on)
  on('session.id', () => ({ value: 'sid-1' }))
  on('session.root', () => ({ value: '/home/t/repo' }))
  on('fs.exists', (_$, e) => ({ value: e.path in files }))
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  const prompts: PromptSubmitInput[] = []
  on('prompt.submit', (_$, e) => {
    prompts.push(e)

    return { text: e.text }
  })
  const compactions: SessionCompactInput[] = []
  on('session.compact', (_$, e) => {
    compactions.push(e)

    return { messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }
  })
  on('command.run', { command: 'compact' }, async () => {
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })

    return { text: '' }
  })

  return { clock, prompts, compactions }
}

// One turn of one model request: the request at the clock's time, the turn ending right after.
async function turn($: Engine, agentId?: string) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1, ...(agentId ? { agentId } : {}) })
  while (!(await stream.next()).done);
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...(agentId ? { agentId } : {}) })
}

const say = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

const idle = (clock: MockClock, minutes: number) => clock.advance(minutes * MIN)

test('off by default: an idle session is left alone', async ($, on) => {
  const { clock, prompts, compactions } = world($, on)
  await turn($)
  await idle(clock, 180)
  expect(prompts).toHaveLength(0)
  expect(compactions).toHaveLength(0)
})

test('58 idle minutes ask for a flush; 58 more after the flush turn compact, then it rests', { options: { cache_saver: true } }, async ($, on) => {
  const { clock, prompts, compactions } = world($, on)
  await turn($)
  await idle(clock, 57)
  expect(prompts).toHaveLength(0)
  await idle(clock, 1)
  expect(prompts).toHaveLength(1)
  expect(prompts[0]?.origin).toEqual({ kind: 'plugin', name: 'workface' })
  expect(prompts[0]?.text).toEqual(expect.stringMatching(`not a message from the owner.*workface at ${WF}`))
  await turn($)
  await idle(clock, 58)
  expect(compactions).toHaveLength(1)
  expect(compactions[0]?.instructions).toEqual(expect.stringMatching(`orchestrates a workface: ${WF}`))
  await idle(clock, 300)
  expect(prompts).toHaveLength(1)
  expect(compactions).toHaveLength(1)
})

test('a message after the flush starts the cycle over', { options: { cache_saver: true } }, async ($, on) => {
  const { clock, prompts, compactions } = world($, on)
  await turn($)
  await idle(clock, 58)
  await turn($)
  await idle(clock, 10)
  await say($, 'back again')
  await turn($)
  await idle(clock, 58)
  expect(compactions).toHaveLength(0)
  expect(prompts.filter(p => p.origin.kind === 'plugin')).toHaveLength(2)
})

test('each main-thread request restarts the idle period; a subagent request does not', { options: { cache_saver: true } }, async ($, on) => {
  const { clock, prompts } = world($, on)
  await turn($)
  await idle(clock, 30)
  await turn($)
  await idle(clock, 30)
  expect(prompts).toHaveLength(0)
  await turn($, 'worker-1')
  await idle(clock, 28)
  expect(prompts).toHaveLength(1)
})

test('turned on after the cache lapsed, it waits for the next request', async ($, on) => {
  const { clock, prompts } = world($, on)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await turn($)
  await idle(clock, 61)
  const { text } = await $.command.run({
    command: 'workface',
    args: 'cache-saver',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect(text).toEqual(expect.stringMatching(/^Cache-saver on\./))
  await clock.settle()
  expect(prompts).toHaveLength(0)
  await turn($)
  await idle(clock, 58)
  expect(prompts).toHaveLength(1)
})
