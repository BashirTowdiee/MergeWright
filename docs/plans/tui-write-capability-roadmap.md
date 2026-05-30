# TUI Write Capability Roadmap

Status: Superseded  
Scope: Historical plan only. Do not use this as an active implementation roadmap.

## Superseding direction

The accepted product direction is web-first.

The web app will become the main human interface for MergeWright. It should be able to run and supervise CLI-equivalent workflows through the Fastify API and shared application services. It may also become a team-visible review UI for evidence, blockers, safe actions, PR state, CI state, merge-readiness, and approvals.

The CLI remains the scriptable automation surface. The web app is the main operator interface for those capabilities. The TUI is superseded and should not receive new product feature investment.

Accepted architecture:

```text
Web app -> Fastify API -> application service -> domain/use case -> adapters
CLI     -> application service -> domain/use case -> adapters
```

Rejected architecture:

```text
Web UI -> shell out directly from React components
Web UI -> parse CLI stdout as product state
TUI    -> primary human interface
TUI    -> duplicated orchestration client
```

## Historical context

This document previously proposed moving the TUI from read-only inspection to safe write-capable orchestration through a service-first command layer.

That service-first principle remains valid, but the target UI changed. The command model, command result model, command risk policy, event model, read models, and audit concepts should be extracted or reused for the web/API path instead of expanding the TUI.

## Replacement roadmap

Use these active documents instead:

- `docs/product/04-roadmap.md`
- `docs/product/05-decisions-and-open-questions.md`
- `docs/ux/04-web-interface-implementation-plan.md`
- `docs/architecture/overview.md`

## Remaining TUI treatment

Short term:

- keep existing TUI code compiling where practical
- keep boundary tests that prevent unsafe TUI imports while the code exists
- do not add new TUI write features
- do not make TUI cleanup block API/web foundation work

Medium term:

- extract reusable read-model, command, event, and safety abstractions
- migrate useful tests to application/API/web layers
- remove or quarantine `src/tui/**` after web run-inspection parity exists
- remove Ink when no supported surface needs it
