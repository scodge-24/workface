<p align="center">
  <img src="assets/hero.svg" alt="workface: live brain surgery on your agent's memory. The agent keeps its notes; you edit them live in a panel; after compaction it wakes up holding them." width="100%">
</p>

<p align="center">
  <a href="https://github.com/scodge-24/workface/actions/workflows/ci.yml"><img src="https://github.com/scodge-24/workface/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-%E2%89%A5%202.1.287-d97757" alt="Claude Code 2.1.287 or later">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6cc070" alt="MIT licence"></a>
</p>

**Live brain surgery on your agent's memory.** When Claude Code compacts, you don't choose what survives, and a
few compactions in you can't tell what the agent still knows, let alone steer it. Workface has the agent keep a
short notes file, hands it back verbatim after every compaction summary, auto or manual, and shows it live in a
panel beside the transcript, where you cut, add or question lines before the agent wakes up with them: you choose
what survives. One install, no setup: it works with the compaction Claude Code already does.

A **tranche** is one long piece of work; its **workface** is the notes file for it, at
`~/.claude/workface/<tranche>/workface.md`: at most 120 lines, links first, then what is true now, and a dated
log. The agent that orchestrates the tranche keeps it current. The approach has been in daily use on long
orchestration runs, first as a skill and now as this mod, and it is kept deliberately small: see
[Make it yours](#make-it-yours) for where to take it further.

## How it works

- **The agent keeps its notes.** As work moves it rewrites live state in place and logs each event through the
  mod, which stamps the time. At 80% of the auto-compact threshold the mod asks it, once per compaction, to bring
  the file up to date first.
- **Compaction keeps them.** On every compaction, auto or manual, the mod briefs the summarizer with the exact
  text that will follow the summary, so the summary spends its words on what the notes don't hold; then it
  re-attaches the notes, read fresh at that moment, right after the summary, labelled as automated context rather
  than a message from you. On resume it attaches them again. A subagent's own compactions are left alone.
- **You choose what survives.** The panel shows the notes as the agent writes them and exactly what the summarizer
  and the agent will receive. Omit a line, add an owner note or ask about one, and the next re-attach carries your
  version.

## Watch and steer it live

<p align="center">
  <img src="assets/panel.svg" alt="The workface panel: tabs, stats, sections on coloured bands, Live state open with coloured shas and status words, a new line marked +, an omitted line struck through, Owner notes open with the owner's line marked by a diamond, ask and omit controls, and the owner note input" width="640">
</p>

- **See what it will remember.** The panel shows the workface as the agent writes it. `+` marks lines written
  since the last re-attach (attach, or the last compaction), and the header shows the line budget, the file's
  age and commits made since it was last written. `Full` shows exactly what the summarizer and the agent will
  receive.
- **Cut what's wrong.** `✕` keeps a stale or mistaken line out of what the agent gets back after compaction,
  without touching the file. `↺` puts it back.
- **Add what's yours.** `◆ note` writes `- owner <time>: <your note>` under `## Owner notes`. The mod records
  which lines you wrote and marks only those (`⟨owner, verified by the workface mod⟩`) when it hands the workface
  over, after stripping that mark from every other line, so no agent can forge it.
- **Ask about anything.** `?` puts a line or a whole section on your next prompt, once. It shows `✓` while pending
  and a second press takes it back.
- **Three tabs.** `Compact` puts sections on coloured bands; click one to expand it, and a long line opens in full
  from its `▸`. `Full` is the hand-over text. `Browse` lists every tranche, the sessions running on it, its age
  and size.
- **Plain Markdown, your shape.** The agent shapes the sections within the 120-line budget; there is no tracker or
  template to adopt, and other tools and agents can read the file.

The panel docks beside the transcript in fullscreen and sits inline above the prompt otherwise, modelled on the
`/diff` panel. Its colours follow your Claude Code theme (see [Configure](#configure)).

## Install

The repository is its own marketplace:

```bash
claude plugin marketplace add scodge-24/workface
claude plugin install workface@workface
```

Or from a session: `/plugin install workface --marketplace scodge-24/workface`. Needs Claude Code v2.1.287 or
later (mods). Run `/reload-plugins` in a session that was open during the install.

Auto-update is off for a marketplace you add yourself: turn it on under **Marketplaces** in `/plugin` (select
`workface`, then **Enable auto-update**), or run `claude plugin update workface@workface` by hand.

## Quick start

```text
/workface start release-2.0   # writes a skeleton for the agent to fill in
/workface                     # opens the panel beside the transcript
```

Then work as usual. The agent updates the workface as things change, and every compaction from then on, auto or
manual, hands it back right after the summary.

<details>
<summary>A fresh skeleton</summary>

```markdown
# release-2.0 — workface (read first after compaction)

Repo(s): `<path>`. Brief: `<path>` (§ index below), or none.

## Doctrine and evidence (links only)
- `<path>` — <what it settles; which § matter>

## Code seams
- `<path>` — <symbols that matter; one known trap>

## Live state (as of 2026-10-03 14:20)
- HEAD / remote: <sha> (<pushed?>; CI <run id, result>)
- Running: <agent/workflow id — what — launched when — what to check on return>
- Work state: <the tracker query that lists it, or: open owner decisions, parked, next in order>

## Policies and recipes
- <push/verify gate, concurrency limits, commands that bit before>

## Log
- 2026-10-03 14:20 — workface started
```

</details>

## Use

| Command | Does |
|---|---|
| `/workface start <tranche>` | Creates the workface from a skeleton and attaches this session to it |
| `/workface attach <tranche>` | Joins an existing tranche and shows the agent its workface |
| `/workface resume` | Shows the attached workface again |
| `/workface log <entry>` | Appends `- YYYY-MM-DD HH:MM — <entry>` to `## Log`, stamped with the local time |
| `/workface detach` | Stops this session orchestrating it; the files stay |
| `/workface` | Opens or closes the panel |

The agent has the same verbs as the tool `mcp__workface__workface`, so it can start or join a tranche when you
ask it to, and the protocol it is handed has it log through `log`, so log times come from the clock, not from the
agent's guess. Main session only: a subagent shares its parent's session id and is refused.

## Configure

Colours are plugin options, shown as rows in `/config` (or set under `pluginConfigs` in `settings.json`):
`color_accent`, `color_sha`, `color_code`, `color_time`, `color_good`, `color_warn`, `color_bad`. Each takes a
Claude Code theme key (`success`, `warning`, `merged`, …), a terminal colour name (`magenta`, `cyan`, …) or a
hex colour (`#ff79c6`). Unset, they follow your theme. To match a statusline that shows git in magenta:

```json
"pluginConfigs": { "workface@workface": { "options": { "color_sha": "magenta" } } }
```

`status_line` (off by default) adds the tranche, line budget, age and commits-since to Claude Code's status line.

## Data and files

Everything stays on your machine. The mod reads and writes files under `~/.claude/workface/`, reads
`~/.claude/sessions/` to show which sessions are running, runs `git log` in the session's repo and the repos a
workface names, and keeps omissions and owner-note records in its plugin store. It makes no network requests.
Run `claude plugin validate` on a checkout to list every call it makes.

A workface is plain Markdown, and each session marker under `~/.claude/workface/sessions/<session-id>` is one
line holding the workface's path, so other tools and agents can read and keep the same tranche.

## Make it yours

Workface is deliberately minimal, a notes file, compaction plumbing and a panel, and it is meant to be forked
rather than configured. There are many ways to go further (decay of old lines, smarter pruning, per-agent notes,
a different summarizer brief), and the seams are small, all in `hooks/`:

- `summarizerBrief` in `hooks/register.tsx`: what the summarizer is told on every compaction.
- `PROTOCOL` and `workfaceMessage`: what the agent is handed after compaction, on attach and on resume (the update
  and prune rules, the provenance label, the owner marks).
- `skeleton`: the file `/workface start` writes.
- The `ui.render` hook: the panel, built from the engine's `Box`, `Text`, `Button` and `Input` elements.
- `hooks/workface.ts`: the pure text functions (parse, omissions, colour spans, owner notes, log), tested directly.

## Develop

```bash
claude plugin validate --strict .
claude plugin test .
tsc -p .            # once `claude --plugin-dir .` has loaded it (the engine writes .claude-plugin/types/)
claude --plugin-dir .
```

See `.claude/CLAUDE.md` for the repository's conventions and `.claude/rules/` for what cost time before.
