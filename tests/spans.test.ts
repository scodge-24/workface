import { expect, test } from 'claude-code/testing'

import { appendLog, spans } from '../hooks/workface'

test('status words, paths, shas and log times get their tones; the rest stays plain', () => {
  const line = '- 2026-10-03 11:05 — gate PASS; `plans/0011.md` f509db3 NOT pushed, then FAIL'
  expect(spans(line).filter(s => s.tone !== undefined)).toEqual([
    { text: '2026-10-03 11:05', tone: 'time' },
    { text: 'PASS', tone: 'good' },
    { text: '`plans/0011.md`', tone: 'code' },
    { text: 'f509db3', tone: 'sha' },
    { text: 'NOT pushed', tone: 'warn' },
    { text: 'FAIL', tone: 'bad' },
  ])
  expect(spans(line).map(s => s.text).join('')).toBe(line)
  expect(spans('- deadbeef and 1234567 are not shas, decade is a word')).toEqual([
    { text: '- deadbeef and 1234567 are not shas, decade is a word' },
  ])
})

test('appendLog adds a ## Log section when the workface has none', () => {
  expect(appendLog('# demo\n- a\n', '- 2026-10-03 12:00 — b')).toBe('# demo\n- a\n\n## Log\n- 2026-10-03 12:00 — b\n')
})
