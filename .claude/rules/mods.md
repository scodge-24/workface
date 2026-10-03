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

## Why

Each of these cost a debugging round building this mod (2026-10-03, then in agent-config `mods/workface`). The cache behaviour
contradicts the API doc and was found only by an end-to-end auto-compaction run.
