import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { autoAttachFor } from '../hooks/workface'

const HOME = '/home/t'
const ROOT = '/home/t/.claude/workface'
const MARKER = `${ROOT}/sessions/sid-1`
const OPS = `${ROOT}/ops/workface.md`
const TEXT = '# ops — workface\n## Live state\n- ufw: on\n'
const OPTIONS = { options: { auto_attach: '~/Work=ops; /srv/data=data' } }

// What the marker held when the chain below the mod ran, as another plugin's SessionStart (recall's notice) sees it.
let markerAtNext: string | undefined

// A filesystem in memory; the session runs in /home/t/Work/tries unless a test says otherwise.
function world(on: On, files: Record<string, string>) {
  mock.env(on, { HOME })
  mock.store(on)
  mock.clock(on)
  on('session.id', () => ({ value: 'sid-1' }))
  on('session.root', () => ({ value: '/home/t/Work' }))
  on('fs.exists', (_$, e) => ({ value: e.path in files }))
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }))
  on('fs.write', (_$, e) => {
    files[e.path] = e.text

    return { value: undefined }
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }))
  on('classic.SessionStart', () => {
    markerAtNext = files[MARKER]

    return {}
  })

  return files
}

test('the deepest configured directory holding the cwd names the tranche', () => {
  const spec = '~/Work=ops\n~/Work/tries = tries;/srv=srv;bad;rel=x;/empty='
  expect(autoAttachFor(spec, HOME, '/home/t/Work')).toEqual({ dir: '/home/t/Work', tranche: 'ops' })
  expect(autoAttachFor(spec, HOME, '/home/t/Work/a/b')).toEqual({ dir: '/home/t/Work', tranche: 'ops' })
  expect(autoAttachFor(spec, HOME, '/home/t/Work/tries/x')).toEqual({ dir: '/home/t/Work/tries', tranche: 'tries' })
  expect(autoAttachFor(spec, HOME, '/home/t/Workshop')).toBeUndefined()
  expect(autoAttachFor('', HOME, '/home/t/Work')).toBeUndefined()
})

test('Windows paths match with either slash and in any case', () => {
  const home = 'C:\\Users\\t'
  expect(autoAttachFor('~/Work=ops', home, 'C:\\Users\\t\\Work\\x')).toEqual({ dir: 'C:/Users/t/Work', tranche: 'ops' })
  expect(autoAttachFor('~\\Work=ops', home, 'c:\\users\\t\\work')).toEqual({ dir: 'C:/Users/t/Work', tranche: 'ops' })
  expect(autoAttachFor('D:\\data\\=data', home, 'D:/data/x')).toEqual({ dir: 'D:/data', tranche: 'data' })
  expect(autoAttachFor('~/Work=ops', home, 'C:\\Users\\t\\Workshop')).toBeUndefined()
})

test('a new session under a configured directory attaches and is handed the workface', OPTIONS, async ($, on) => {
  const files = world(on, { [OPS]: TEXT })
  const started = await $.classic.SessionStart({ source: 'startup', cwd: '/home/t/Work/tries' })
  expect(files[MARKER]).toBe(`${OPS}\n`)
  expect(markerAtNext).toBe(`${OPS}\n`)
  expect(started.additionalContext?.[0]).toEqual(
    expect.stringMatching(/attached by the workface mod at session startup, by auto_attach for \/home\/t\/Work\.[\s\S]*ufw: on/),
  )
})

test('a session elsewhere, or before the tranche has a workface, stays unattached', OPTIONS, async ($, on) => {
  const files = world(on, { [OPS]: TEXT })
  const elsewhere = await $.classic.SessionStart({ source: 'startup', cwd: '/home/t/dev/repo' })
  expect(files[MARKER]).toBeUndefined()
  expect(elsewhere.additionalContext ?? []).toEqual([])
  const unstarted = await $.classic.SessionStart({ source: 'startup', cwd: '/srv/data' })
  expect(files[MARKER]).toBeUndefined()
  expect(unstarted.additionalContext ?? []).toEqual([])
})

test('an existing marker wins, and a resumed session is never attached anew', OPTIONS, async ($, on) => {
  const other = `${ROOT}/thermal/workface.md`
  const files = world(on, { [OPS]: TEXT, [other]: '# thermal\n', [MARKER]: `${other}\n` })
  await $.classic.SessionStart({ source: 'clear', cwd: '/home/t/Work' })
  expect(files[MARKER]).toBe(`${other}\n`)
  delete files[MARKER]
  await $.classic.SessionStart({ source: 'resume', cwd: '/home/t/Work' })
  expect(files[MARKER]).toBeUndefined()
})

test('with the option unset nothing attaches', async ($, on) => {
  const files = world(on, { [OPS]: TEXT })
  await $.classic.SessionStart({ source: 'startup', cwd: '/home/t/Work' })
  expect(files[MARKER]).toBeUndefined()
})
