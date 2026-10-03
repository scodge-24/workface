export type View = 'workface' | 'preview'

declare module 'claude-code' {
  interface PluginState {
    'workface-mod': {
      view: View
      // Section headings the panel shows expanded.
      expanded: string[]
      // Omission keys by workface path: a section heading or a line's text.
      omitted: Record<string, string[]>
    }
  }
}
