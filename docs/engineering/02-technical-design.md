# Technical Design

## Purpose

This document records the initial technical design direction for Shepherds-Staff.

## Core design direction

The system should be refactored toward explicit application services and domain-level orchestration primitives so the CLI is no longer the only consumer of the workflow engine.

## Suggested module boundaries

```txt
src/
  cli/
  application/
  orchestration/
  providers/
  artefacts/
  git/
  config/
  reports/
  safety/
```

## Execution model

A command should construct a validated execution request, pass it to an application service, and receive a structured result.

The service should coordinate:

- Config loading.
- Stage loading.
- Run creation or lookup.
- Phase execution.
- Provider execution.
- Artefact persistence.
- Safety checks.
- Report generation.

## Provider contract

Provider execution should eventually be expressed through a provider-neutral contract.

Example shape:

```ts
interface AgentProvider {
  execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResult>;
}
```

Provider results should include:

- exit status
- stdout/stderr or stream references
- final message
- usage metadata where available
- provider-specific diagnostics where useful

## Run state

Run state should be machine-readable and stable enough for CLI, API, and GUI consumers.

Suggested files:

- `run.json`
- `artefacts.json`
- `events.jsonl`
- phase-specific prompt/output/log files

## Event model

The system should record important events as structured entries:

- run created
- phase started
- phase completed
- phase failed
- safety check started
- safety check failed
- review completed
- fix attempt started
- report generated

## Error handling

Errors should be explicit, typed where practical, and mapped to clear CLI/API messages.

Important failure categories:

- config error
- stage error
- provider error
- safety violation
- check failure
- artefact write failure
- invalid continuation

## Technical constraints

- Preserve current CLI compatibility where practical.
- Avoid duplicating orchestration logic across surfaces.
- Avoid introducing network or hosted dependencies for core operation.
- Keep testability high around safety and run-state transitions.
