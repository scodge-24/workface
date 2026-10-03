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
