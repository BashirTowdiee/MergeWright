# Data Design

## Purpose

This document defines the initial data model for Shepherds-Staff product state and artefacts.

## Storage approach

Shepherds-Staff should remain filesystem-first for local operation.

Current and future state should be represented through:

- project config files
- stage Markdown files
- run directories
- machine-readable run metadata
- human-readable phase artefacts
- structured event logs

## Core entities

### Project

Represents a configured target repository.

Fields:

- id
- name
- config path
- workspace path
- stage directory
- run directory
- checks config
- write-safety config
- provider config, future

### Stage

Represents an implementation task or workflow unit.

Fields:

- id
- project id
- title
- source path
- content hash
- created/updated metadata, where available

### Run

Represents one execution of a stage or workflow.

Fields:

- run id
- project id
- stage id
- status
- started at
- completed at
- mode
- allow writes flag
- dry-run flag
- provider/model metadata
- phase statuses
- final status
- report paths

### Phase

Represents a workflow step.

Fields:

- phase id
- type
- status
- started at
- completed at
- provider
- model
- prompt path
- output path
- stdout path
- stderr path
- exit code
- error summary

### Artefact

Represents a persisted file produced by a run.

Fields:

- id
- run id
- phase id, optional
- type
- path
- media type
- title
- created at
- summary, optional

### Event

Represents a structured lifecycle event.

Fields:

- id
- timestamp
- run id
- phase id, optional
- event type
- severity
- message
- payload

## Suggested files

Inside each run directory:

```txt
run.json
artefacts.json
events.jsonl
planner/
builder/
reviewer/
fix/
write-audit/
reports/
```

## Status model

Suggested run statuses:

- pending
- running
- passed
- failed
- needs_fix
- needs_review
- checks_failed
- stopped
- cancelled

Suggested phase statuses:

- pending
- running
- skipped
- passed
- failed
- blocked

## Data design principles

- Human-readable artefacts should remain easy to open directly.
- Machine-readable metadata should be stable and versioned.
- GUI/API consumers should not need to parse arbitrary Markdown to understand run state.
- Artefact paths should be relative where possible for portability.
- Sensitive provider or environment data should not be persisted unless explicitly required.
