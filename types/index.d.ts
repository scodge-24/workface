export type View = 'workface' | 'preview' | 'tranches'
export type Ask = { key: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'workface': {
      view: View
      // Section headings the panel shows expanded.
      expanded: string[]
      // Long lines the panel shows in full, as `<section heading>\n<line>`.
      openLines: string[]
      // What the next prompt carries from the panel's `ask`, if anything.
      asked: Ask | null
      // Commits newer than the workface's last write, in the repos it names.
      behind: number
      // Whether this compaction cycle's flush reminder has gone out.
      nudged: boolean
      // Whether the trim reminder went out since the workface last went over budget.
      trimWarned: boolean
      // Omission keys by workface path: a section heading or a line's text.
      omitted: Record<string, string[]>
    }
  }
}
