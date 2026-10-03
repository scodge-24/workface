import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { isItem, parse, withoutOmitted } from './workface'

// Share of the auto-compact threshold at which the agent is asked to flush the workface.
const NUDGE_AT = 0.8
const BUDGET_LINES = 120
const PANEL = 'workface-panel'
const PANE = 'workface'
// What the legacy SessionStart hook (workface-session-start.sh) prints; this mod speaks for it where loaded.
const LEGACY = /^This session (orchestrates the workface at|was attached to a workface at)/

const view = atom({ plugin: 'workface-mod', key: 'view' } as const, 'workface')
const expanded = atom({ plugin: 'workface-mod', key: 'expanded' } as const, [])
const omitted = atom({ plugin: 'workface-mod', key: 'omitted' } as const, {})

type Workface = { path: string; text: string; mtimeMs: number }

// The workface skill's marker: ~/.claude/workface/sessions/<session-id> holds the workface path.
async function attached($: EngineInterface): Promise<Workface | undefined> {
  const home = await $.env.get('HOME')
  const marker = `${home}/.claude/workface/sessions/${await $.session.id()}`
  if (!(await $.fs.exists(marker))) return undefined
  const path = (await $.fs.read(marker)).trim()
  if (!path || !(await $.fs.exists(path))) return undefined
  const [text, stat] = await Promise.all([$.fs.read(path), $.fs.stat(path)])

  return { path, text, mtimeMs: stat.mtimeMs }
}

// Omissions persist across sessions in the store, keyed by workface path; the atom mirrors them for drawing.
async function omittedFor($: EngineInterface, path: string): Promise<string[]> {
  const all = (await $.store.get('omitted')) as Record<string, string[]> | undefined

  return all?.[path] ?? []
}

async function toggleOmitted($: EngineInterface, path: string, key: string) {
  await update($, omitted, all => {
    const now = all[path] ?? []

    return { ...all, [path]: now.includes(key) ? now.filter(k => k !== key) : [...now, key] }
  })
  await $.store.set('omitted', await read($, omitted))
}

async function restoreAll($: EngineInterface, path: string) {
  await update($, omitted, all => ({ ...all, [path]: [] }))
  await $.store.set('omitted', await read($, omitted))
}

async function closePanel($: EngineInterface) {
  await $.store.set('autoOpen', false)
  await $.ui.close({ id: PANE })
}

const summarizerBrief = (path: string) =>
  [
    `This session orchestrates a workface: ${path}. It is re-attached in full right after this summary, so do not restate it.`,
    'Spend the summary on what the workface may not hold yet: state changes since its last update (commits and shas,',
    'pushes, agents or workflows launched or returned with their ids, review verdicts, owner decisions, measurements),',
    'the exact step in flight and what it was waiting on, and any instruction the owner gave since.',
    'Keep ids, shas, paths and commands verbatim. Mark anything inferred rather than observed as unverified.',
  ].join(' ')

const workfaceMessage = (wf: Workface, skip: readonly string[], when: string) =>
  [
    `This session orchestrates the workface at ${wf.path} (file last written ${new Date(wf.mtimeMs).toISOString()}),`,
    `attached by the workface mod ${when}.`,
    'Before acting, reconcile it against reality (git log and status in the repos it names, `br ready` / `br blocked`',
    'where .beads/ exists, any agents or workflows it says are running); where they disagree, reality wins and the',
    'workface is fixed first. Do not re-ask anything it records as decided.',
    '',
    withoutOmitted(wf.text, skip),
  ].join('\n')

const flushNudge = (path: string, share: number) =>
  `Context is at ${share}% of the auto-compact threshold. Before it compacts, bring the workface at ${path} up to date: ` +
  'rewrite live state in place, one log line per state change since its last write, unverified items marked. ' +
  'The workface is re-attached after compaction; what is in neither it, the repo nor beads may not survive the summary.'

const tranche = (path: string) => path.split('/').slice(-2, -1)[0] ?? path

function age(ms: number): string {
  const minutes = Math.round(ms / 60_000)

  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`
}

async function refresh($: EngineInterface) {
  $.ui.invalidate('ui.render')
  const wf = await attached($)
  if (!wf) return $.ui.status(undefined)
  const lines = wf.text.trimEnd().split('\n').length
  const over = lines > BUDGET_LINES ? '!' : ''
  $.ui.status(`workface ${tranche(wf.path)} · ${lines}${over}/${BUDGET_LINES}L · ${age((await $.clock.now()) - wf.mtimeMs)} old`)
}

async function compactThreshold($: EngineInterface) {
  const { context } = await $.session.usage({ breakdown: 'summary' })

  return context.breakdown?.autoCompactThreshold
}

export const register: Register = on => {
  let threshold: number | undefined
  let isNudged = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PANEL, description: 'Open or close the workface panel' })
    const stored = (await $.store.get('omitted')) as Record<string, string[]> | undefined
    await update($, omitted, () => stored ?? {})
    // As the diff panel does: it reopens unasked only for someone who opened it and did not close it since.
    if ((await attached($)) && (await $.store.get('autoOpen')) === true) void $.ui.open({ id: PANE, title: 'Workface' })
    await refresh($)
    $.clock.every(60_000, () => void refresh($))

    return next(e)
  })

  // The agent rewrites the workface with these tools; redraw the panel and the status line after each.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'Bash')) await refresh($)

    return ran
  })

  // Resume and attach get the workface from here; the legacy hook's pointer is dropped so there is one source.
  on('classic.SessionStart', async ($, e, next) => {
    const out = await next(e)
    const wf = await attached($)
    if (!wf) return out
    const others = (out.additionalContext ?? []).filter(text => !LEGACY.test(text.trim()))
    const ours = e.source === 'compact' ? [] : [workfaceMessage(wf, await omittedFor($, wf.path), `at session ${e.source}`)]

    return { ...out, additionalContext: [...others, ...ours] }
  })

  on('session.compact', async ($, e, next) => {
    // A subagent's own compaction (agentId set) keeps the orchestrator's workface out.
    const wf = e.agentId === undefined ? await attached($) : undefined
    if (!wf) return next(e)
    const instructions = [e.instructions, summarizerBrief(wf.path)].filter(Boolean).join('\n\n')
    const done = await next({ ...e, instructions })
    // A precompute only prepares a summary; the workface is attached when a compaction installs.
    if (e.trigger === 'precompute' || done.skip !== undefined) return done
    isNudged = false
    threshold = undefined
    const [summary, ...kept] = done.messages
    if (!summary) return done
    // Read again: the file may have changed while the summary was written, or since a precompute.
    const fresh = (await attached($)) ?? wf
    const text = workfaceMessage(fresh, await omittedFor($, fresh.path), 'right after this compaction summary')

    return { ...done, messages: [summary, { role: 'user', text, toolUses: [] }, ...kept] }
  })

  on('session.measure', async ($, e, next) => {
    const out = await next(e)
    if (isNudged || !e.changed.includes('context') || e.context.tokens === undefined) return out
    threshold ??= await compactThreshold($)
    if (!threshold || e.context.tokens < NUDGE_AT * threshold) return out
    const wf = await attached($)
    if (!wf) return out
    isNudged = true
    const share = Math.round((100 * e.context.tokens) / threshold)
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: flushNudge(wf.path, share) }] } })

    return out
  })

  on('command.run', { command: PANEL }, async $ => {
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await closePanel($)

      return { text: 'Workface panel closed.' }
    }
    if (!(await attached($))) return { text: 'No workface is attached to this session; `/workface start` or `attach` first.' }
    await $.store.set('autoOpen', true)
    await $.ui.open({ id: PANE, title: 'Workface' })

    return { text: 'Workface panel opened.' }
  })

  // Closed by the person (its tab, Esc): stay closed until they open it again.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') await $.store.set('autoOpen', false)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const wf = await attached($)
    if (!wf) return <Text dimColor>No workface is attached to this session.</Text>
    const shown = await read($, view)
    const open = await read($, expanded)
    const skip = (await read($, omitted))[wf.path] ?? []
    const lines = wf.text.trimEnd().split('\n').length
    const { sections } = parse(wf.text)

    const header = (
      <Box key="header" flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexShrink={1}>
          <Text bold wrap="truncate-end">{tranche(wf.path)}</Text>
          <Text dimColor color={lines > BUDGET_LINES ? 'red' : undefined}>
            {lines}/{BUDGET_LINES} lines · {age((await $.clock.now()) - wf.mtimeMs)} old
          </Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button
            key="view"
            plain
            label={`view: ${shown === 'preview' ? 'Preview' : 'Workface'}`}
            onPress={() => void update($, view, now => (now === 'preview' ? 'workface' : 'preview'))}
          />
          <Button key="close" plain role="dismiss" label="✕" onPress={() => void closePanel($)} />
        </Box>
      </Box>
    )

    if (shown === 'preview') {
      const preview = [
        '**Added to every compaction’s summarizer instructions**',
        '',
        summarizerBrief(wf.path),
        '',
        '**Inserted after the compaction summary**',
        '',
        workfaceMessage(wf, skip, 'right after this compaction summary'),
      ].join('\n')

      return (
        <Box flexDirection="column">
          {header}
          <Markdown key="preview" text={preview.slice(0, 10_000)} />
        </Box>
      )
    }

    const rows = sections.flatMap(section => {
      const isOpen = open.includes(section.heading)
      const isOmitted = skip.includes(section.heading)
      const items = section.lines.filter(isItem)
      const head = (
        <Box key={`s:${section.heading}`} flexDirection="row" justifyContent="space-between">
          <Button
            key={`x:${section.heading}`}
            plain
            label={`${isOpen ? '▾' : '▸'} ${section.heading.slice(3)}  ${items.length}`}
            dimColor={isOmitted}
            onPress={() =>
              void update($, expanded, now =>
                now.includes(section.heading) ? now.filter(h => h !== section.heading) : [...now, section.heading],
              )
            }
          />
          <Button
            key={`o:${section.heading}`}
            plain
            dimColor
            label={isOmitted ? 'keep' : 'omit'}
            onPress={() => void toggleOmitted($, wf.path, section.heading)}
          />
        </Box>
      )
      if (!isOpen) return [head]

      return [
        head,
        ...items.map((line, i) => {
          const isOut = isOmitted || skip.includes(line)

          return (
            <Box key={`l:${section.heading}:${i}`} flexDirection="row" justifyContent="space-between" paddingLeft={2}>
              <Text dimColor={isOut} strikethrough={isOut} wrap="truncate-end">
                {line}
              </Text>
              {!isOmitted && (
                <Button
                  key={`lo:${section.heading}:${i}`}
                  plain
                  dimColor
                  label={skip.includes(line) ? 'keep' : 'omit'}
                  onPress={() => void toggleOmitted($, wf.path, line)}
                />
              )}
            </Box>
          )
        }),
      ]
    })

    // Omissions whose line no longer exists in the file have lapsed; count only the live ones.
    const live = skip.filter(key => wf.text.split('\n').includes(key))

    return (
      <Box flexDirection="column">
        {header}
        {rows}
        {live.length > 0 && (
          <Box key="footer" flexDirection="row" gap={1} marginTop={1}>
            <Text dimColor>
              {live.length} omitted from what agents get after compaction ·
            </Text>
            <Button key="restore" plain dimColor label="restore all" onPress={() => void restoreAll($, wf.path)} />
          </Box>
        )}
      </Box>
    )
  })
}
