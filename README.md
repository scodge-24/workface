# workface mod (Claude Code)

Claude Code's workface. The `workface` skill is installed for Codex only; in Claude Code this mod is the whole
thing. It keeps the skill's files (`~/.claude/workface/<tranche>/workface.md` and the session markers under
`sessions/`), so a tranche moves between Codex and Claude unchanged.

| Hook | Does |
|---|---|
| `session.compact` | Adds a summarizer brief to every compaction (manual, auto, plugin, precompute) carrying the exact workface text that will follow the summary, so the summary leaves it out (headings only above 12k chars, since the request runs near the window limit); after an installed compaction, inserts the current workface right after the summary, labelled as not from the owner. Subagent compactions are left alone. |
| `session.measure` | At 80% of the auto-compact threshold, appends one hidden note asking the agent to flush the workface. |
| `classic.SessionStart` | Attaches the workface on resume/startup and drops the legacy `workface-session-start.sh` pointer, so a session with the mod has one source. |
| `/workface` | `start <tranche>`, `attach <tranche>`, `resume`, `detach`; bare or `panel` opens or closes the panel (docked in fullscreen, inline otherwise), modelled on the `/diff` panel: sections expand on click, a line too long for the panel opens in full from its `▸` bullet, each section or line can be omitted from what agents get after compaction, `view:` toggles a preview of exactly that. Colours are theme keys, so it follows the Claude Code theme. |
| panel extras | Tabs `Workface` / `Preview` / `Tranches` (every tranche, its running sessions, age, size). Header warns `N commits since` (newer than the workface's last write, in the session's repo and the repos it names in backticks) and `N new since re-attach` (lines not in the snapshot taken on attach and at each compaction, marked `+`). Each section and line has `ask`, which rides the next prompt as context, as the diff panel's does. The `◆ note` input adds an owner line under `## Owner notes`. |
| owner provenance | The mod records the owner's notes in its store; when it hands the workface to an agent, only those lines end `⟨owner, verified by the workface mod⟩`, after stripping that mark from every other line, so an agent cannot forge it. |
| `mcp__workface-mod__workface` | The same verbs as a tool the model calls (`action`, `tranche`); refused from a subagent, which shares the session id. |
| protocol | The skill's update and prune rules ride in every attached-workface message (attach, resume, after compaction). |
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
