# workface mod (Claude Code)

The Claude Code half of the `workface` skill. It reads the skill's session markers
(`~/.claude/workface/sessions/<session-id>`), so `/workface start|attach|detach` drive it unchanged.

| Hook | Does |
|---|---|
| `session.compact` | Adds a summarizer brief to every compaction (manual, auto, plugin, precompute); after an installed compaction, inserts the current workface right after the summary. Subagent compactions are left alone. |
| `session.measure` | At 80% of the auto-compact threshold, appends one hidden note asking the agent to flush the workface. |
| `classic.SessionStart` | Attaches the workface on resume/startup and drops the legacy `workface-session-start.sh` pointer, so a session with the mod has one source. |
| `/workface-panel` | Opens or closes the panel (docked in fullscreen, inline otherwise), modelled on the `/diff` panel: sections expand on click, each section or line can be omitted from what agents get after compaction, `view:` toggles a preview of exactly that. |
| status line | `workface <tranche> · <lines>/120L · <age> old` |

Omissions live in the plugin store keyed by workface path; the file itself is never changed. An omission
is keyed by the line's text, so rewriting the line lapses it.

## Loading

`~/.claude/settings.json` → `env.CLAUDE_CODE_PLUGIN_DIRS` names this folder. Sessions started after that
load it; interactive ones hot-reload edits here. Sessions started before it keep the legacy hook alone.

## Checking a change

```bash
claude plugin validate mods/workface
claude plugin test mods/workface
tsc -p mods/workface   # once a session has loaded it (.claude-plugin/types/ is engine-written, gitignored)
```
