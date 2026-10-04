import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { logEntryCount, splitLog, withArchivePointer } from '../hooks/workface'

const HOME = '/home/t'
const ROOT = '/home/t/.claude/workface'
const MARKER = `${ROOT}/sessions/sid-1`
const WF = `${ROOT}/demo/workface.md`
const TOOL = 'mcp__workface__workface'

const entries = (n: number, from = 1) =>
  Array.from({ length: n }, (_, k) => `- 2026-09-${String(from + k).padStart(2, '0')} 10:00 — e${from + k}`)
const workface = (log: string[]) => ['# demo', '', '## Live state', '- HEAD: abc1234', '', '## Log', ...log, ''].join('\n')

// A filesystem in memory, attached to WF, and the host commands the mod runs: date, rm and git.
function world(on: On, files: Record<string, string>) {
  files[MARKER] = `${WF}\n`
  mock.env(on, { HOME })
  mock.store(on)
  mock.clock(on)
  on('session.id', () => ({ value: 'sid-1' }))
  on('session.root', () => ({ value: '/home/t/repo' }))
  on('fs.exists', (_$, e) => ({ value: e.path in files }))
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }))
  on('fs.write', (_$, e) => {
    files[e.path] = e.text

    return { value: undefined }
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }))
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'rm') delete files[e.argv[2] ?? '']

    return { value: { exitCode: 0, stdout: e.argv[0] === 'date' ? '2026-10-04 12:00\n' : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', () => ({ result: 'ok' }))

  return files
}

const call = ($: Engine, args: Record<string, unknown>) => $.tool.call({ tool: TOOL, ...args })

test('splitLog moves the oldest entries with their continuation lines and leaves undated notes', () => {
  const text = workface(['- Lesson: rebase the child', ...entries(2), '  continued detail', ...entries(2, 3)])
  const split = splitLog(text, 2)
  expect(split?.moved).toEqual(['- 2026-09-01 10:00 — e1', '- 2026-09-02 10:00 — e2', '  continued detail'])
  expect([split?.count, split?.first, split?.last]).toEqual([2, '2026-09-01', '2026-09-02'])
  expect(split?.text).toBe(workface(['- Lesson: rebase the child', ...entries(2, 3)]))
  expect(splitLog(text, 4)).toBeUndefined()
  expect(logEntryCount(text)).toBe(4)
})

test('the archive pointer sits first under ## Log and is replaced, never repeated', () => {
  const once = withArchivePointer(workface(entries(1)), 'Archive: a (1 chunk)')
  const twice = withArchivePointer(once, 'Archive: a (2 chunks)')
  expect(twice).toBe(workface(['Archive: a (2 chunks)', ...entries(1)]))
})

test('archive moves the older entries to a chunk, indexes it with the summary and points the workface at the index', async ($, on) => {
  const files = world(on, { [WF]: workface(entries(13)) })
  const done = await call($, { action: 'archive', summary: 'solver switch a1b2c3d; PR #112' })
  expect(String(done.result)).toEqual(expect.stringMatching('Archived 3 log entries \\(2026-09-01 → 2026-09-03\\)'))
  expect(files[`${ROOT}/demo/log/2026-09-01_2026-09-03.md`]).toBe(`# demo: log, 2026-09-01 → 2026-09-03\n\n${entries(3).join('\n')}\n`)
  expect(files[`${ROOT}/demo/log/README.md`]).toEqual(expect.stringMatching('then open that chunk.\n\n- \\['))
  expect(files[`${ROOT}/demo/log/README.md`]).toEqual(
    expect.stringMatching('- \\[2026-09-01_2026-09-03.md\\]\\(2026-09-01_2026-09-03.md\\) · 2026-09-01 → 2026-09-03 · 3 entries · solver switch a1b2c3d; PR #112'),
  )
  expect(files[WF]).toBe(
    workface([`Archive: ${ROOT}/demo/log/README.md (1 chunk of older log entries through 2026-09-03, with summaries)`, ...entries(10, 4)]),
  )
})

test('a hand-kept log.md moves in as its own chunk, and the agent is told to fix pointers to it', async ($, on) => {
  const legacy = `${ROOT}/demo/log.md`
  const files = world(on, { [WF]: workface(entries(11)), [legacy]: '- 2026-08-20 — old\n- 2026-08-22 — older\n' })
  const done = await call($, { action: 'archive', summary: 'early setup', keep: 10 })
  expect(String(done.result)).toEqual(expect.stringMatching('log.md moved to'))
  expect(legacy in files).toBe(false)
  expect(files[`${ROOT}/demo/log/2026-08-20_2026-08-22.md`]).toBe('- 2026-08-20 — old\n- 2026-08-22 — older\n')
  const rows = (files[`${ROOT}/demo/log/README.md`] ?? '').split('\n').filter(l => l.startsWith('- ['))
  expect(rows.length).toBe(2)
  expect(rows[0]).toEqual(expect.stringMatching('moved in from log.md'))
  expect(files[WF]).toEqual(expect.stringMatching('\\(2 chunks of older log entries'))
})

test('archive refuses without a summary or with nothing older than keep', async ($, on) => {
  world(on, { [WF]: workface(entries(5)) })
  expect((await call($, { action: 'archive', summary: ' ' })).deny).toEqual(expect.stringMatching('Give a summary'))
  expect((await call($, { action: 'archive', summary: 'x' })).deny).toEqual(expect.stringMatching('nothing was archived'))
})

test('a log past the limit warns once, and an edit taking the file over budget hears it after its result', async ($, on) => {
  const files = world(on, { [WF]: workface(entries(25)) })
  const first = await call($, { action: 'log', entry: 'gate PASS' })
  expect(String(first.result)).toEqual(expect.stringMatching('26 log entries. Trim it now. .*`archive`'))
  const second = await call($, { action: 'log', entry: 'gate 2 PASS' })
  expect(String(second.result)).not.toEqual(expect.stringMatching('Trim it now'))
  await call($, { action: 'archive', summary: 'gates' })
  files[WF] = workface(Array.from({ length: 130 }, (_, k) => `- note ${k}`))
  const edit = await $.tool.call({ tool: 'Edit', file_path: WF, old_string: 'a', new_string: 'b' })
  expect(edit.context?.[0]).toEqual(expect.stringMatching('/120 lines with 0 log entries. Trim it now. Collapse finished work'))
})
