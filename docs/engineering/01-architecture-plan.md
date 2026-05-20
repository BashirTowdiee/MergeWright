# Architecture Plan

## Status

Proposed architecture direction. This document defines the target shape for future implementation, not a claim that all layers already exist.

## Architecture goal

MergeWright should be structured around a reusable orchestration core that can support CLI, local API, dashboard, and future editor integrations without duplicating workflow logic.

## Current architecture posture

The current product is CLI-first. That is acceptable for the current stage, but future dashboard/API work requires clearer internal boundaries:

- command parsing and terminal rendering
- application use cases
- orchestration lifecycle rules
- provider execution
- artefact persistence
- target repository inspection and audit
- report generation

## Target architecture

```txt
CLI / local API / dashboard / editor extension
  -> application services
  -> orchestration core
  -> provider adapters
  -> filesystem artefact store
  -> target repository adapter
```

The CLI and local API should both call application services. The dashboard should call the local API. The editor extension should either call the local API or act as a thin launcher for the dashboard.

## Core components

### CLI surface

Parses commands, validates command-level inputs, invokes application services, and renders terminal output.

Responsibilities:

- command parsing
- help text
- human-readable output
- process exit codes
- CLI-specific flags

Non-responsibilities:

- owning orchestration rules
- owning provider behaviour
- owning safety policy

### Application services

Coordinate use cases such as running a stage, continuing a run, generating reports, and checking write safety.

Examples:

- initialise project
- run stage
- continue run
- inspect run
- generate report
- check write safety

### Orchestration core

Owns run lifecycle, phase ordering, safety gates, auto-chain decisions, and continuation rules.

Responsibilities:

- phase sequencing
- phase status transitions
- auto-chain decision flow
- retry limits
- allowed next actions
- blocked state reasons

### Provider adapters

Translate provider-neutral execution requests into concrete provider calls.

Codex is the current provider. Additional providers should be added only after the provider contract is explicit.

### Artefact store

Persists prompts, logs, outputs, audit files, reports, and machine-readable metadata.

It should support:

- human-readable Markdown/text artefacts
- machine-readable manifests
- relative paths for portability
- stable IDs for API/dashboard use

### Target repository adapter

Handles workspace validation, git status, diffs, changed files, and write-audit capture.

### Local API, proposed

Exposes structured project, run, phase, artefact, report, and event data for local UI surfaces.

### Dashboard, proposed

Consumes the local API. It must not bypass orchestration or safety rules.

## Architectural principles

- Keep orchestration logic out of CLI-only code.
- Keep provider-specific logic behind adapters.
- Keep safety rules centralised and testable.
- Keep artefacts human-readable and machine-readable.
- Keep local-first operation as the default.
- Prefer explicit state transitions over inferred state from logs.
- Avoid a dashboard that shells out to CLI commands for every operation once application services exist.

## Future API/dashboard shape

```txt
Dashboard -> Local API -> Application services -> Orchestration core
CLI       -> Application services -> Orchestration core
```

This keeps the CLI and dashboard aligned without requiring the dashboard to parse terminal output.

## Architecture stages

### Stage 1: Stabilise product state

- Define run status model.
- Define phase status model.
- Define artefact index.
- Define lifecycle event schema.

### Stage 2: Extract application services

- Move command use cases behind explicit service functions.
- Keep CLI behaviour compatible.
- Add tests around service outputs.

### Stage 3: Add local API

- Expose read-only project/run/artefact endpoints first.
- Add live events next.
- Add mutation endpoints only when safety and cancellation behaviour are clear.

### Stage 4: Add dashboard

- Build read-only run inspection first.
- Add execution controls after API mutation contracts are tested.

## Key architecture decisions needed

- Stable run lifecycle states.
- Stable phase status model.
- Artefact manifest format.
- Provider execution contract.
- Local event stream model.
- Boundaries between CLI rendering and core orchestration.
- Whether the first dashboard should be read-only or control-capable.
- Whether run indexing should derive from the filesystem or use a local database.
