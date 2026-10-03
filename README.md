# Workface

A Claude Code mod that keeps a long-running agent's working notes intact through every compaction, including
auto-compaction, and shows them in a panel you can steer.

A **workface** is a short, links-first scratch file (at most 120 lines) at
`~/.claude/workface/<tranche>/workface.md`: where things are, what is true now, and a dated log. An agent
that orchestrates a long piece of work (a *tranche*) keeps it current. When the conversation compacts, the
mod makes sure the agent wakes up holding it.

## Install

The repository is its own marketplace:

```bash
claude plugin marketplace add scodge-24/workface
claude plugin install workface@workface
```

Or from a session: `/plugin install workface --marketplace scodge-24/workface`. Needs Claude Code v2.1.287 or
later (mods). Run `/reload-plugins` in a session that was open during the install.

## Use

| Command | Does |
|---|---|
| `/workface start <tranche>` | Creates the workface from a skeleton and attaches this session to it |
| `/workface attach <tranche>` | Joins an existing tranche and shows the agent its workface |
| `/workface resume` | Shows the attached workface again |
| `/workface detach` | Stops this session orchestrating it; the files stay |
| `/workface` | Opens or closes the panel |

The agent has the same verbs as the tool `mcp__workface__workface`, so it can start or join a tranche when you
ask it to. A subagent is refused: it shares its parent's session id and would re-point it.

## What it does

**Through compaction**

- **Briefs the summarizer** on every compaction (manual, auto, plugin-started and precomputed) with the exact
  workface text that will follow the summary, so the summary records only what the workface does not hold.
  Above 12k characters the summarizer gets the section headings alone, since that request runs near the
  context limit.
- **Re-attaches the workface** right after the summary, read fresh at that moment, labelled as automated
  context rather than a message from you, with the update and prune protocol.
- **Asks for a flush** once, at 80% of the auto-compact threshold, so the agent writes down what it knows first.
- **Attaches on resume** and leaves a subagent's own compactions alone.

**The panel** (docked beside the transcript in fullscreen, inline above the prompt otherwise), modelled on the
`/diff` panel:

- `Workface`: sections on coloured bands; click to expand, and a long line opens in full from its `▸`. Each
  section and line has `?` to ask (your next prompt carries it, once; `✓` while pending, press again to take
  it back) and `✕` to leave it out of what agents get after compaction (`↺` restores). `+` marks lines written
  since the last re-attach. The header warns about commits made since the workface was last written.
- `◆ note`: adds your own line under `## Owner notes`. The mod records which lines you wrote and marks only
  those as yours (`⟨owner, verified by the workface mod⟩`) when it hands the workface to an agent, after
  stripping that mark from every other line, so an agent cannot forge it.
- `Preview`: exactly what the summarizer and the agent receive. `Tranches`: every tranche, the sessions
  running on it, its age and size.

Colours are theme keys, so the panel follows your Claude Code theme. A status line shows the tranche, its line
budget, its age and commits since it was last written.

## Configure

Colours are plugin options, shown as rows in `/config` (or set under `pluginConfigs` in `settings.json`):
`color_accent`, `color_sha`, `color_code`, `color_time`, `color_good`, `color_warn`, `color_bad`. Each takes a
Claude Code theme key (`success`, `warning`, `merged`, …), a terminal colour name (`magenta`, `cyan`, …) or a
hex colour (`#ff79c6`). Unset, they follow your theme. To match a statusline that shows git in magenta:

```json
"pluginConfigs": { "workface@workface": { "options": { "color_sha": "magenta" } } }
```

## Data

Everything stays on your machine. The mod reads and writes files under `~/.claude/workface/`, reads
`~/.claude/sessions/` to show which sessions are running, runs `git log` in the repos a workface names, and
keeps omissions and owner-note records in its plugin store. It makes no network requests. Run
`claude plugin validate` on a checkout to list every call it makes.

## Codex and other agents

The files are plain Markdown, and the session markers under `~/.claude/workface/sessions/` follow the
`workface` skill's layout, so a tranche can move between Claude Code and a Codex session using that skill.

## Develop

```bash
claude plugin validate --strict .
claude plugin test .
tsc -p .            # after a session has loaded the plugin (the engine writes .claude-plugin/types/)
claude --plugin-dir .
```

See `.claude/CLAUDE.md` for the repository's conventions and `.claude/rules/` for what cost time before.
