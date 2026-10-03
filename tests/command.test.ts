import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/t'
const ROOT = '/home/t/.claude/workface'
const MARKER = `${ROOT}/sessions/sid-1`

// The person typing `/workface <args>` in the fullscreen terminal.
const run = ($: Engine, args: string) =>
  $.command.run({ command: 'workface', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })

// A filesystem in memory, and the two host commands the mod runs: date and rm.
function world(on: On, files: Record<string, string>) {
  mock.env(on, { HOME })
  mock.store(on)
  mock.clock(on)
  on('session.id', () => ({ value: 'sid-1' }))
  on('fs.exists', (_$, e) => ({ value: e.path in files }))
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }))
  on('fs.write', (_$, e) => {
    files[e.path] = e.text

    return { value: undefined }
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }))
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'rm') delete files[e.argv[2] ?? '']

    return { value: { exitCode: 0, stdout: e.argv[0] === 'date' ? '2026-10-03 12:00\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.close', () => ({ value: undefined }))

  return files
}

test('/workface start writes the skeleton and the marker, and hands the agent the protocol', async ($, on) => {
  const files = world(on, {})
  const { text } = await run($, 'start demo')
  expect(files[MARKER]).toBe(`${ROOT}/demo/workface.md\n`)
  expect(files[`${ROOT}/demo/workface.md`]).toEqual(expect.stringMatching(/## Live state \(as of 2026-10-03 12:00\)[\s\S]*- 2026-10-03 12:00 — workface started/))
  expect(text).toEqual(expect.stringMatching(/Workface protocol[\s\S]*fill in its links/))
})

test('start refuses an existing tranche and attach a missing one', async ($, on) => {
  world(on, { [`${ROOT}/old/workface.md`]: '# old\n' })
  expect((await run($, 'start old')).text).toEqual(expect.stringMatching('attach to it instead'))
  expect((await run($, 'attach nope')).text).toEqual(expect.stringMatching('start it instead'))
  expect((await run($, 'attach ../etc')).text).toEqual(expect.stringMatching('Name the tranche'))
})

test('attach then detach leaves no marker', async ($, on) => {
  const files = world(on, { [`${ROOT}/old/workface.md`]: '# old\n## Live state\n- HEAD: abc1234\n' })
  expect((await run($, 'attach old')).text).toEqual(expect.stringMatching('HEAD: abc1234'))
  expect(MARKER in files).toBe(true)
  expect((await run($, 'detach')).text).toEqual(expect.stringMatching('Detached from'))
  expect(MARKER in files).toBe(false)
})

test('the model can attach through the tool, but a subagent is refused', async ($, on) => {
  world(on, { [`${ROOT}/old/workface.md`]: '# old\n' })
  on('tool.call', () => ({ result: 'unanswered' }))
  const sub = await $.tool.call({ tool: 'mcp__workface-mod__workface', input: { action: 'attach', tranche: 'old' }, agentId: 'worker-1' })
  expect(sub.deny ?? '').toEqual(expect.stringMatching('Only the main orchestrating session'))
  const main = await $.tool.call({ tool: 'mcp__workface-mod__workface', input: { action: 'attach', tranche: 'old' } })
  expect(String(main.result)).toEqual(expect.stringMatching('attached by the workface mod just now, by attach'))
})
