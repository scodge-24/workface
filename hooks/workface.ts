// The workface as the panel lists it: the lines before the first `## ` heading, then one entry per section.
// An omission key is a section's heading line or a line's own text, so editing a line lapses its omission.

export type Section = { heading: string; lines: string[] }
export type Parsed = { head: string[]; sections: Section[] }

export function parse(text: string): Parsed {
  const head: string[] = []
  const sections: Section[] = []
  for (const line of text.trimEnd().split('\n')) {
    if (line.startsWith('## ')) sections.push({ heading: line, lines: [] })
    else if (sections.length > 0) sections[sections.length - 1]?.lines.push(line)
    else head.push(line)
  }

  return { head, sections }
}

export const isItem = (line: string) => line.trim() !== ''

// The workface with the owner's omissions taken out, and a note saying how many, so the agent knows it is partial.
export function withoutOmitted(text: string, omitted: readonly string[]): string {
  if (omitted.length === 0) return text
  const skip = new Set(omitted)
  const { head, sections } = parse(text)
  let dropped = 0
  const kept = [...head]
  for (const s of sections) {
    if (skip.has(s.heading)) {
      dropped += 1
      continue
    }
    kept.push(s.heading)
    for (const line of s.lines) {
      if (isItem(line) && skip.has(line)) dropped += 1
      else kept.push(line)
    }
  }
  if (dropped === 0) return text

  return `${kept.join('\n')}\n\n(${dropped} item${dropped === 1 ? '' : 's'} omitted by the owner in the workface panel; the file has them.)`
}

// A line split for colour: paths and commands, shas, log times, and the status words a re-orienting reader scans for.
export type Tone = 'code' | 'sha' | 'time' | 'good' | 'warn' | 'bad'
export type Span = { text: string; tone?: Tone }

const TOKEN = new RegExp(
  [
    '(`[^`]+`)',
    '(\\b\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}\\b)',
    '(\\bNOT pushed\\b|\\bPREDICTED\\b|\\bunverified\\b|\\bagent-reported\\b|\\bunreviewed\\b|\\bblocked\\b)',
    '(\\bPASS(?:ED)?\\b|\\bpushed\\b|\\bmerged\\b)',
    '(\\bFAIL(?:ED)?\\b|\\bfailed\\b)',
    '(\\b(?=[0-9a-f]*\\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,12}\\b)',
  ].join('|'),
  'g',
)
const TONES: readonly Tone[] = ['code', 'time', 'warn', 'good', 'bad', 'sha']

export function spans(line: string): Span[] {
  const out: Span[] = []
  let at = 0
  for (const match of line.matchAll(TOKEN)) {
    const start = match.index ?? 0
    if (start > at) out.push({ text: line.slice(at, start) })
    out.push({ text: match[0], tone: TONES[match.slice(1).findIndex(group => group !== undefined)] })
    at = start + match[0].length
  }
  if (at < line.length) out.push({ text: line.slice(at) })

  return out
}

// Owner notes: lines the owner typed in the panel, kept under one section the agents also read.
export const OWNER_SECTION = '## Owner notes'
// Appended by the mod to lines it has on record as the owner's. Stripped from every other line first, so an
// agent writing it into the file proves nothing.
export const OWNER_MARK = ' ⟨owner, verified by the workface mod⟩'

export function addOwnerNote(text: string, line: string): string {
  const lines = text.trimEnd().split('\n')
  const at = lines.indexOf(OWNER_SECTION)
  if (at >= 0) {
    let end = at + 1
    while (end < lines.length && !lines[end]?.startsWith('## ')) end += 1
    while (end > at + 1 && lines[end - 1]?.trim() === '') end -= 1
    lines.splice(end, 0, line)
  } else {
    const log = lines.findIndex(l => /^## log\b/i.test(l))
    lines.splice(log >= 0 ? log : lines.length, 0, ...(log >= 0 ? [OWNER_SECTION, line, ''] : ['', OWNER_SECTION, line]))
  }

  return `${lines.join('\n')}\n`
}

// Appends a log line at the end of `## Log` (the section is added when missing).
export function appendLog(text: string, line: string): string {
  const lines = text.trimEnd().split('\n')
  const at = lines.findIndex(l => /^## log\b/i.test(l))
  if (at < 0) return `${[...lines, '', '## Log', line].join('\n')}\n`
  let end = at + 1
  while (end < lines.length && !lines[end]?.startsWith('## ')) end += 1
  while (end > at + 1 && lines[end - 1]?.trim() === '') end -= 1
  lines.splice(end, 0, line)

  return `${lines.join('\n')}\n`
}

// Log entries: the dated `- YYYY-MM-DD` items under `## Log`, each with its indented continuation lines.
// Undated items there (notes, lessons) are not entries: they stay put and never count.
const DATED = /^- (\d{4}-\d{2}-\d{2})/
// The line under `## Log` the mod keeps pointing at the tranche's archive index.
export const ARCHIVE_POINTER = 'Archive: '

type Entry = { start: number; stop: number; date: string }

function logEntryRanges(lines: readonly string[]): Entry[] {
  const at = lines.findIndex(l => /^## log\b/i.test(l))
  if (at < 0) return []
  const entries: Entry[] = []
  for (let i = at + 1; i < lines.length && !lines[i]?.startsWith('## '); i += 1) {
    const line = lines[i] ?? ''
    const date = DATED.exec(line)?.[1]
    const last = entries[entries.length - 1]
    if (date) entries.push({ start: i, stop: i + 1, date })
    else if (last?.stop === i && /^\s+\S/.test(line)) last.stop = i + 1
  }

  return entries
}

export const logEntryCount = (text: string) => logEntryRanges(text.trimEnd().split('\n')).length

export type Split = { text: string; moved: string[]; count: number; first: string; last: string }

// Takes all but the last `keep` log entries out of the workface, verbatim and oldest first; undefined when none go.
export function splitLog(text: string, keep: number): Split | undefined {
  const lines = text.trimEnd().split('\n')
  const entries = logEntryRanges(lines)
  const go = entries.slice(0, Math.max(0, entries.length - keep))
  const first = go[0]
  const last = go[go.length - 1]
  if (!first || !last) return undefined
  const drop = new Set(go.flatMap(e => Array.from({ length: e.stop - e.start }, (_, k) => e.start + k)))

  return {
    text: `${lines.filter((_, i) => !drop.has(i)).join('\n')}\n`,
    moved: go.flatMap(e => lines.slice(e.start, e.stop)),
    count: go.length,
    first: first.date,
    last: last.date,
  }
}

// Sets the archive pointer as the first line under `## Log`, replacing the one there (the section is added when missing).
export function withArchivePointer(text: string, pointer: string): string {
  const lines = text.trimEnd().split('\n')
  const at = lines.findIndex(l => /^## log\b/i.test(l))
  if (at < 0) return `${[...lines, '', '## Log', pointer].join('\n')}\n`
  let old = -1
  for (let i = at + 1; i < lines.length && !lines[i]?.startsWith('## '); i += 1) if (lines[i]?.startsWith(ARCHIVE_POINTER)) old = i
  if (old >= 0) lines[old] = pointer
  else lines.splice(at + 1, 0, pointer)

  return `${lines.join('\n')}\n`
}

// The archive index: a header, then one row per chunk, oldest first.
export const archiveIndexHead = (tranche: string) =>
  [
    `# ${tranche}: log archive`,
    '',
    'Older workface log entries, moved here verbatim by the workface mod. One row per chunk, oldest first:',
    'search the summaries for what you need, then open that chunk.',
    '',
  ].join('\n')

export const archiveRow = (name: string, first: string, last: string, count: number, summary: string) =>
  `- [${name}](${name}) · ${first} → ${last} · ${count} entr${count === 1 ? 'y' : 'ies'} · ${summary}`

export const archiveRows = (index: string) => index.split('\n').filter(l => l.startsWith('- [')).length

// Adds a row at the end of the index, a blank line apart from its header.
export const withArchiveRow = (index: string, row: string) =>
  `${index.trimEnd()}\n${archiveRows(index) === 0 ? '\n' : ''}${row}\n`

// The dates a text names, earliest and latest, for naming a chunk moved in from elsewhere.
export function dateSpan(text: string): [string, string] | undefined {
  const dates = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m => m[0]).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]

  return first && last ? [first, last] : undefined
}

export function markOwner(text: string, owned: readonly string[]): string {
  const mine = new Set(owned)

  return text
    .split('\n')
    .map(line => line.split(OWNER_MARK).join(''))
    .map(line => (mine.has(line) ? `${line}${OWNER_MARK}` : line))
    .join('\n')
}

// Directories a workface names in backticks, absolute or under ~: the candidates for "commits since update".
export function namedPaths(text: string, home: string): string[] {
  const found = [...text.matchAll(/`(~?\/[^`\s*?]+)`/g)].map(m => (m[1] ?? '').replace(/^~(?=\/)/, home).replace(/\/$/, ''))

  return [...new Set(found)]
}
