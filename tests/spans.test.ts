import { expect, test } from 'claude-code/testing'

import { spans } from '../hooks/workface'

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
