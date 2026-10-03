---
# Copy to <topic>.md and tighten these globs to exactly where the rule
# applies — the rule costs context only when a matching file is in play.
# This template's paths never match anything, so it stays inert.
paths:
  - '_rules-template-never-matches/**'
---

# <Topic>

> One-line: what this rule prevents or decides.

## The rule

State the repo-specific decision or gotcha directly. Good rules correct what
an agent would otherwise plausibly do wrong here — a workflow quirk (build
order, test constraints), a local convention not derivable from the code, a
past failure worth not repeating.

## Why

One or two sentences — the incident or reasoning, so a future session can
judge whether the rule still applies.
