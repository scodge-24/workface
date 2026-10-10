---
paths:
  - 'hooks/register.tsx'
  - 'hooks/workface.ts'
  - 'tests/**'
  - 'types/index.d.ts'
---

# Claude Code mods

> This mod is live code in every session that loads it: check a change before it lands.

## The rule

- Sessions that load this checkout (`--plugin-dir`, `CLAUDE_CODE_PLUGIN_DIRS`) hot-reload a saved edit. Run
  `claude plugin validate --strict .` and `claude plugin test .` before committing.
- A helper that takes `$` must be a top-level function declaration in the hooks module, or validate
  refuses it.
- Never use `h` or `Fragment` as a name of your own in a `.tsx` file, not even an arrow parameter: JSX compiles
  to calls of them. Local validate passes it; the directory portal blocks it (`MOD_CAPABILITY_USE_NOT_PLAIN`).
- Keep `"types"` in `plugin.json` although the directory portal warns it is unknown (`UNKNOWN_KEY`): it is what
  holds every `$.state` key to `types/index.d.ts`. Only `validate --strict .claude-plugin/plugin.json` runs that
  check; `validate .` at the repo root reads the marketplace and passes a broken or missing contract.
- Never name the hooks folder's manifest (the one listing the modules) in a committed text file, not even in
  rule frontmatter, and never glob over `hooks/`: the portal holds the plugin (`COMMAND_NAMES_MOD_FILE`).
- `prompt.context` blocks are served from cache after a mid-turn compaction, even after
  `$.ui.invalidate('prompt.context')`. Put post-compaction context in the `session.compact` result's
  `messages`.
- A plugin's own `$.session.compact` skips that plugin's `session.compact` hook, so the workface brief and
  re-attach never run. To compact from the mod, use `$.command.run({ command: 'compact', args: '' })`: the
  engine's own compaction, as a typed `/compact`. (The test kit also leaves `trigger` unset on a plugin's call.)
- `Select` is missing from some surfaces (mobile). Use Buttons for controls a pane must draw everywhere.
- In `claude plugin test`, nothing answers an engine noun unless the test does: every `$.fs`,
  `$.session.id`, `$.store` or `$.clock` call the plugin makes needs an `on(...)` answer or `mock.*`.
  Register all of them before the test's first `$` call.
- A `tool.call` event carries the tool's arguments flat beside `tool` (`e.action`), never under `e.input`.
  The test kit passes whatever shape the test gives, so a test written with `input: {…}` passes while every
  live call throws. Write tool-call tests with flat arguments and check a new tool once with `claude -p`.
- The engine writes `.claude-plugin/types/` only for a `--plugin-dir` or hot-reload load, not for the
  marketplace install. Without it `tsc -p .` cannot extend its tsconfig; `noEmit` in `tsconfig.json` stops it
  writing `.js` beside the sources. Type-check against the plugin-authoring skill's `types/claude-code.d.ts` instead.

## Why

Each of these cost a debugging round building this mod (2026-10-03). The cache behaviour
contradicts the API doc and was found only by an end-to-end auto-compaction run.
