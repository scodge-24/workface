---
paths:
  - 'hooks/**'
  - 'tests/**'
  - 'types/**'
---

# Claude Code mods

> This mod is live code in every session that loads it: check a change before it lands.

## The rule

- Sessions that load this checkout (`--plugin-dir`, `CLAUDE_CODE_PLUGIN_DIRS`) hot-reload a saved edit. Run
  `claude plugin validate --strict .` and `claude plugin test .` before committing.
- A helper that takes `$` must be a top-level function declaration in the hooks module, or validate
  refuses it.
- `prompt.context` blocks are served from cache after a mid-turn compaction, even after
  `$.ui.invalidate('prompt.context')`. Put post-compaction context in the `session.compact` result's
  `messages`.
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
