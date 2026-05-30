# TUI Architecture

Status: Superseded

The MergeWright TUI is no longer the intended primary human interface. The accepted product direction is web-first: the web app becomes the main interface for running and supervising CLI-equivalent workflows, while the CLI remains the scriptable automation surface.

This document is retained to preserve the old TUI boundary rules while useful code is extracted or removed.

## Current mode

The current TUI is read-only. It can inspect runs, phases, safe-action previews, artefacts, evidence snippets, and reviewer findings.

Do not add new TUI product features unless the work is explicitly for migration, compatibility, or removing TUI dependencies.

## Replacement interface model

Accepted path:

```text
Web app -> Fastify API -> application service -> domain/use case -> adapters
CLI     -> application service -> domain/use case -> adapters
```

The web app should be the main human control room for:

- running CLI-equivalent workflows
- continuing runs
- inspecting artefacts
- reviewing blockers
- previewing safe actions
- showing team-visible review evidence
- displaying PR, CI, and merge-readiness state
- collecting explicit approvals where required

The web app must not become an unstructured shell wrapper. It should call the Fastify API and shared application services, which can execute the same workflow capabilities exposed by the CLI.

## Historical TUI write-capable rule

The TUI was previously allowed to become write-capable only through typed application commands and shared application services.

Allowed path while TUI remains in the repo:

```text
TUI -> typed command -> application service -> domain/use case -> adapters
```

Forbidden paths:

```text
TUI -> shell command
TUI -> direct file edit
TUI -> parse CLI output
TUI -> mutate git, plans, or runs directly
```

## Remaining responsibilities

While the TUI exists, it may render read models, collect user intent, request command descriptions, display command risk, ask for confirmation when required, submit typed commands to the application command service, and render typed results.

The TUI must not call shell execution APIs, run package manager commands, run git commands, run provider backends, parse CLI output, write coordination files directly, mutate run artefacts directly, modify git state directly, or duplicate orchestration business logic.

## Dependency direction

TUI code under `src/tui/**` can depend on TUI view helpers, read-model services, typed command definitions, command service interfaces, and command result or progress-event types.

TUI code under `src/tui/**` must not depend on shell execution APIs, Node file write APIs, CLI command implementations, orchestration runner internals, git mutation adapters, or backend execution adapters.

## Migration model

1. Keep the TUI compiling while web/API foundations are built.
2. Extract reusable read models, command types, event abstractions, and safety concepts into shared application layers.
3. Move product investment to the web app.
4. Remove or quarantine `src/tui/**` once the web app has useful run-inspection parity.
5. Remove Ink when no remaining supported surface needs it.
