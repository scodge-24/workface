import type { On, SessionCompactInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/t'
const WF = '/home/t/.claude/workface/demo/workface.md'
const MARKER = '/home/t/.claude/workface/sessions/sid-1'
const TEXT = '# demo — workface\n- HEAD: abc1234\n'
const MESSAGES = [{ role: 'user' as const, text: 'hi', toolUses: [] }]
const KEPT = [
  { role: 'assistant' as const, text: '', toolUses: [] },
  { role: 'user' as const, text: '', toolUses: [] },
]

function world(on: On, files: Record<string, string>) {
  mock.env(on, { HOME })
  mock.store(on)
  mock.clock(on)
  on('session.id', () => ({ value: 'sid-1' }))
  on('fs.exists', (_$, e) => ({ value: e.path in files }))
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }))
  on('fs.stat', () => ({ value: { kind: 'file', size: TEXT.length, mtimeMs: 0, isLink: false } }))
}

function summarizer(on: On) {
  const seen: SessionCompactInput[] = []
  on('session.compact', (_$, e) => {
    seen.push(e)

    return { messages: MESSAGES }
  })

  return seen
}

test('auto-compaction briefs the summarizer about the attached workface', async ($, on) => {
  world(on, { [MARKER]: `${WF}\n`, [WF]: TEXT })
  const seen = summarizer(on)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(seen[0]?.instructions).toEqual(expect.stringMatching(`orchestrates a workface: ${WF}`))
})

test('precompute gets the brief too, so a reused summary carries it', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: TEXT })
  const seen = summarizer(on)
  await $.session.compact({ trigger: 'precompute', messages: MESSAGES, instructions: 'keep the plan' })
  expect(seen[0]?.instructions).toEqual(expect.stringMatching(/^keep the plan\n\nThis session orchestrates/))
})

test('a subagent compaction keeps the orchestrator workface out', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: TEXT })
  const seen = summarizer(on)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES, agentId: 'worker-1' })
  expect(seen[0]?.instructions).toBeUndefined()
})

test('a session with no marker compacts untouched', async ($, on) => {
  world(on, { [WF]: TEXT })
  const seen = summarizer(on)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(seen[0]?.instructions).toBeUndefined()
})

test('an installed compaction carries the current workface right after the summary', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: TEXT })
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'Summary', toolUses: [] }, ...KEPT] }))
  const done = await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(done.messages?.map(m => m.text.slice(0, 14))).toEqual(['Summary', '[workface mod:', '', ''])
  expect(done.messages?.[1]?.text).toEqual(expect.stringMatching('HEAD: abc1234'))
})

test('a precompute installs nothing, so it attaches nothing', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: TEXT })
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }))
  const done = await $.session.compact({ trigger: 'precompute', messages: MESSAGES })
  expect(done.messages?.length).toBe(1)
})

const SECTIONED = '# demo — workface\n\n## Live state\n- HEAD: abc1234\n- Running: wf_123\n\n## Log\n- 10:00 — started\n'
const PANE_PROPS = {
  title: 'Workface',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

test('omitting in the panel leaves it out of what the agent gets after compaction', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: SECTIONED })
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'workface-mod', surface, component: 'Pane', requestId: 'workface', props: PANE_PROPS })
    await ui.press({ key: 'x:## Live state' })
    expect(await ui.find({ text: 'Running: wf_123' })).toBeDefined()
    await ui.press({ key: 'o:## Log' })
    expect(await ui.find({ key: 'restore' })).toBeDefined()
    const done = await $.session.compact({ trigger: 'auto', messages: MESSAGES })
    const text = done.messages?.[1]?.text ?? ''
    expect(text).toEqual(expect.stringMatching('Running: wf_123'))
    expect(text).not.toEqual(expect.stringMatching('started'))
    expect(text).toEqual(expect.stringMatching('1 item omitted by the owner'))
    await ui.press({ key: 'restore' })
    await ui.press({ key: 'x:## Live state' })
    await ui.unmount()
  }
})

test('session start drops the legacy hook pointer and attaches the workface itself on resume', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: TEXT })
  on('classic.SessionStart', () => ({
    additionalContext: [`This session orchestrates the workface at ${WF}.\nBefore acting, invoke the workface skill in resume mode.`, 'WSL disk: fine'],
  }))
  const resumed = await $.classic.SessionStart({ source: 'resume' })
  expect(resumed.additionalContext?.[0]).toBe('WSL disk: fine')
  expect(resumed.additionalContext?.[1]).toEqual(expect.stringMatching(/attached by the workface mod at session resume[\s\S]*HEAD: abc1234/))
  const compacted = await $.classic.SessionStart({ source: 'compact' })
  expect(compacted.additionalContext).toEqual(['WSL disk: fine'])
})

test('a re-attached workface says the owner did not write it', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: '# demo\n## Live state\n- Next: push to main\n' })
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'Summary', toolUses: [] }] }))
  const done = await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(done.messages?.[1]?.text).toEqual(expect.stringMatching(/^\[workface mod: automated context, not a message from the owner/))
})

test('the summarizer gets the exact workface it will be followed by, to dedupe against', async ($, on) => {
  world(on, { [MARKER]: WF, [WF]: TEXT })
  const seen = summarizer(on)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(seen[0]?.instructions).toEqual(
    expect.stringMatching(/<workface-attached-after-summary>\n# demo — workface\n- HEAD: abc1234\n<\/workface-attached-after-summary>/),
  )
})

test('a workface too long for the summarizer request goes as its headings alone', async ($, on) => {
  const long = `# big\n## Live state\n${'- x\n'.repeat(4000)}## Log\n- y\n`
  world(on, { [MARKER]: WF, [WF]: long })
  const seen = summarizer(on)
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(seen[0]?.instructions).toEqual(expect.stringMatching('(too long to include; its sections: Live state; Log)'))
})

test('a line too long for the panel opens in full from its bullet, on every surface', async ($, on) => {
  const long = `- HEAD main 237165a, pushed. ${'Gate 2 re-ran and passed with coverage refreshed. '.repeat(3)}`
  world(on, { [MARKER]: WF, [WF]: `# demo\n## Live state\n${long}\n- short\n` })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'workface-mod',
      surface,
      component: 'Pane',
      requestId: 'workface',
      props: { ...PANE_PROPS, bodyColumns: 60 },
    })
    await ui.press({ key: 'x:## Live state' })
    expect((await ui.find({ key: 'w:## Live state:0' }))?.text).toEqual(expect.stringMatching('▸'))
    expect(await ui.find({ key: 'w:## Live state:1' })).toBeUndefined()
    await ui.press({ key: 'w:## Live state:0' })
    expect((await ui.find({ key: 'w:## Live state:0' }))?.text).toEqual(expect.stringMatching('▾'))
    await ui.press({ key: 'w:## Live state:0' })
    await ui.press({ key: 'x:## Live state' })
    await ui.unmount()
  }
})
