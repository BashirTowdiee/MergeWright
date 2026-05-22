# TUI Architecture

Status: Active guidance

The MergeWright TUI is an operator interface over the same application behaviour used by the CLI, MCP integrations, and future web surfaces. It must not grow a second execution path.

## Current mode

The current TUI is read-only. It can inspect runs, phases, safe-action previews, artefacts, evidence snippets, and reviewer findings.

## Write-capable rule

The TUI may become write-capable only through typed application commands and shared application services.

Allowed path:

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

## Responsibilities

The TUI may render read models, collect user intent, request command descriptions, display command risk, ask for confirmation when required, submit typed commands to the application command service, and render typed results.

The TUI must not call shell execution APIs, run package manager commands, run git commands, run provider backends, parse CLI output, write coordination files directly, mutate run artefacts directly, modify git state directly, or duplicate orchestration business logic.

## Dependency direction

TUI code under `src/tui/**` can depend on TUI view helpers, read-model services, typed command definitions, command service interfaces, and command result or progress-event types.

TUI code under `src/tui/**` must not depend on shell execution APIs, Node file write APIs, CLI command implementations, orchestration runner internals, git mutation adapters, or backend execution adapters.

## Rollout model

Write capability should be introduced in this order:

1. architecture guardrails and drift tests
2. typed command model
3. typed command results
4. command descriptions and confirmation gates
5. command service boundary
6. read/write model split
7. low-risk metadata or coordination commands
8. planner/reviewer orchestration commands
9. write-safety-gated builder and fixer commands
10. typed progress events and audit logs
