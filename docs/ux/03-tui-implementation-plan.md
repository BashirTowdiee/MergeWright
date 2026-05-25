# TUI Implementation Plan

## Status

Superseded.

The accepted product direction has moved from a TUI-primary interface to a web-first local control room. This document is retained as historical context only.

Do not use this document as the active implementation plan. Use `docs/ux/04-web-interface-implementation-plan.md` and `plans/roadmap.md` instead.

## Superseding decision

The TUI is no longer the target product surface. Existing TUI work may be mined for useful command, event, read-model, and safety abstractions, but future interface investment goes into the web app.

Accepted target interface model:

```txt
Web app -> Fastify API -> application services -> domain/use cases -> adapters
CLI     -> application services -> domain/use cases -> adapters
```

Rejected path:

```txt
TUI -> primary human interface
TUI -> new feature investment
TUI -> duplicated orchestration client
Web UI -> shell out to CLI -> parse stdout
```

## Historical context

This file previously described an Ink-based terminal UI as the primary human interface. That direction has been replaced because MergeWright needs richer inspection and control surfaces for:

- run history
- phase timelines
- artefact browsing
- diff and code viewing
- reviewer findings
- safe actions
- command previews
- approval gates
- live events
- PR and CI state
- audit history

Those workflows fit a web cockpit better than a terminal UI.

## Reusable concepts from the TUI work

The following concepts can still be extracted and reused:

- typed command model
- command result model
- command risk model
- command confirmation model
- command audit concepts
- evented command service pattern
- run summary/detail read models, after removing TUI-specific naming
- phase, artefact, reviewer finding, and safe action read models
- selection/read-model derivation tests where they remain useful

## Code treatment

Existing TUI code should be treated as temporary spike/client code.

Short term:

- keep it compiling while shared application services are extracted
- do not add new TUI features
- do not add more Ink-specific product work
- do not make TUI cleanup block API/web foundation work

Medium term:

- extract reusable read models and command/event abstractions
- migrate useful tests to application/API/web layers
- remove or quarantine `src/tui/**`
- remove Ink dependency if no longer used
- remove TUI scripts and active docs

## Active replacement plan

See:

- `plans/roadmap.md`
- `docs/product/04-roadmap.md`
- `docs/product/05-decisions-and-open-questions.md`
- `docs/ux/04-web-interface-implementation-plan.md`
