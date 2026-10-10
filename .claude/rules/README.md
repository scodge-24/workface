# Rules

Path-conditioned rules that Claude Code loads based on file context
([docs](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/)).
This README is the index — agents that don't auto-ingest rules
enter here and read the rules matching the files they touch.

Rules use `paths:` frontmatter to declare when they load; see `_template.md`
for the shape.

## Available Rules

| Rule | Loaded When |
| ---- | ----------- |
| [mods.md](mods.md) | the hooks module and helpers, `tests/**`, the types contract — validate/test before committing; `$` helpers top-level; no `h` as a name; no globs over `hooks/`; post-compaction context goes in `session.compact` messages; compact via `/compact`, not `$.session.compact`; test-kit mocking |

## Adding a Rule

1. Copy `_template.md` to `<topic>.md`; tighten the `paths:` globs to exactly
   where the rule applies.
2. Add its row to the table above.
3. Repo-specific content only — a gotcha that cost real time, a local
   convention, a workflow quirk.
