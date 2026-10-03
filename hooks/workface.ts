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
