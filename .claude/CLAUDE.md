# workface

## Project Overview

A Claude Code mod (a plugin of function hooks) that carries a long-running agent's workface through every
compaction and draws it in a panel. Published from this repository as its own marketplace (`workface@workface`).
Stack: TypeScript hooks module, no build step; `claude plugin test` runs the tests.

## Development Commands

```bash
claude plugin validate --strict .   # manifest, hooks and every $ call; must pass before a commit
claude plugin test .                # tests/*.test.ts against the engine
tsc -p .                            # type-check; needs .claude-plugin/types/, which a loading session writes
claude --plugin-dir .               # try it in a session (hot-reloads saved edits)
```

## Workflow

- Conventional commits with a scope: `feat(panel): ...`, `fix(compact): ...`.
- Releases: any change to `hooks/`, `types/` or the manifest that users should get is a release. Bump `version`
  in `.claude-plugin/plugin.json`, push, then `claude plugin tag --push` (tags `workface--v<version>`). Without a
  bump, installs are cached by version and `claude plugin update` keeps users on the old copy.
- Never change the plugin `name` (`workface`): installs, the store and the tool name (`mcp__workface__workface`)
  are keyed by it. Change `displayName` instead.

## Key Files

- `hooks/register.tsx` — every hook: compaction, flush nudge, SessionStart, `/workface`, the tool, the panel.
- `hooks/workface.ts` — pure text functions (parse, omissions, colour spans, owner notes); test these directly.
- `types/index.d.ts` — the `$.state` contract; every atom key the module uses is declared here.
- `tests/` — engine tests; mock every engine noun the code path touches.

## Constraints

- No network calls. The README's Data section lists what the mod touches; keep it true.
- Stay tracker-agnostic: no beads or other tool names in the protocol text.
- Text the mod puts in the conversation is labelled as not from the owner; owner marks come only from the store.
- The workface file format and session markers are a stable format other tools read: change them only compatibly.

Repo rules: `.claude/rules/README.md` is the index.
