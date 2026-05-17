# Architecture Plan

## Architecture goal

Shepherds-Staff should be structured around a reusable orchestration core that can support CLI, local API, GUI, and future editor integrations.

## Target architecture

```txt
CLI / API / GUI / editor extension
  -> application services
  -> orchestration core
  -> provider adapters
  -> filesystem artefact store
  -> target repository
```

## Core components

### CLI surface

Parses commands, validates command-level inputs, invokes application services, and renders terminal output.

### Application services

Coordinate use cases such as running a stage, continuing a run, generating reports, and checking write safety.

### Orchestration core

Owns run lifecycle, phase ordering, safety gates, auto-chain decisions, and continuation rules.

### Provider adapters

Translate provider-neutral execution requests into concrete provider calls. Codex is the first provider.

### Artefact store

Persists prompts, logs, outputs, audit files, reports, and machine-readable metadata.

### Target repository adapter

Handles git status, diffs, write-audit capture, and workspace validation.

## Architectural principles

- Keep orchestration logic out of CLI-only code.
- Keep provider-specific logic behind adapters.
- Keep safety rules centralised and testable.
- Keep artefacts human-readable and machine-readable.
- Keep local-first operation as the default.

## Future API/dashboard shape

The local API should expose orchestration state and actions without becoming a separate implementation.

```txt
Dashboard -> Local API -> Application services -> Orchestration core
CLI       -> Application services -> Orchestration core
```

## Key architecture decisions needed

- Stable run lifecycle states.
- Stable phase status model.
- Artefact manifest format.
- Provider execution contract.
- Local event stream model.
- Boundaries between CLI rendering and core orchestration.
