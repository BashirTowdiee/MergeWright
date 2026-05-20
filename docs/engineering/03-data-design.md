# Data Design

## Status

Proposed data model. This document defines the target shape needed for CLI, API, and dashboard consistency. Existing runtime files may not yet match every proposed field.

## Purpose

This document defines the initial data model for MergeWright product state and artefacts.

## Storage approach

MergeWright should remain filesystem-first for local operation.

Current and future state should be represented through:

- project config files
- stage Markdown files
- run directories
- machine-readable run metadata
- human-readable phase artefacts
- structured event logs
- generated reports

A local database may be introduced later as an index/cache, but the filesystem should remain the source of truth for local runs until there is a strong reason to change it.

## Design goals

- Let the CLI, API, and dashboard read the same run state.
- Avoid requiring consumers to parse arbitrary Markdown to determine status.
- Preserve human-readable artefacts.
- Make run state portable across machines where practical.
- Make safety and blocked states explicit.

## Core entities

### Project

Represents a configured target repository.

Fields:

- `id`
- `name`
- `configPath`
- `workspacePath`
- `stageDirectory`
- `runDirectory`
- `checksConfig`
- `writeSafetyConfig`
- `providerConfig`, future

### Stage

Represents an implementation task or workflow unit.

Fields:

- `id`
- `projectId`
- `title`
- `sourcePath`
- `contentHash`
- `createdAt`, optional
- `updatedAt`, optional

### Run

Represents one execution of a stage or workflow.

Fields:

- `schemaVersion`
- `runId`
- `projectId`
- `stageId`
- `status`
- `startedAt`
- `completedAt`, optional
- `mode`
- `allowWrites`
- `dryRun`
- `provider`
- `model`
- `phases`
- `autoChain`, optional
- `checks`, optional
- `reports`, optional
- `availableActions`
- `blockedReason`, optional
- `finalStatus`, optional

### Phase

Represents a workflow step.

Fields:

- `phaseId`
- `type`
- `status`
- `startedAt`, optional
- `completedAt`, optional
- `provider`, optional
- `model`, optional
- `promptPath`, optional
- `outputPath`, optional
- `stdoutPath`, optional
- `stderrPath`, optional
- `exitCode`, optional
- `artefactIds`
- `errorSummary`, optional
- `blockedReason`, optional

### Artefact

Represents a persisted file produced by a run.

Fields:

- `id`
- `runId`
- `phaseId`, optional
- `type`
- `path`
- `mediaType`
- `title`
- `createdAt`
- `summary`, optional

Suggested artefact types:

- `prompt`
- `model-output`
- `stdout`
- `stderr`
- `git-diff`
- `write-audit`
- `check-output`
- `change-report`
- `pr-summary`
- `plan-html`
- `metadata`

### Event

Represents a structured lifecycle event.

Fields:

- `id`
- `timestamp`
- `runId`
- `phaseId`, optional
- `type`
- `severity`
- `message`
- `payload`

Suggested event severities:

- `debug`
- `info`
- `warning`
- `error`

Suggested event types:

- `run.created`
- `run.completed`
- `run.failed`
- `phase.started`
- `phase.completed`
- `phase.failed`
- `phase.blocked`
- `safety.started`
- `safety.passed`
- `safety.failed`
- `check.started`
- `check.passed`
- `check.failed`
- `report.generated`

## Suggested run directory layout

Inside each run directory:

```txt
run.json
artefacts.json
events.jsonl
planner/
builder/
reviewer/
fix-planner/
fix-executor/
checks/
write-audit/
reports/
```

## Status model

Suggested run statuses:

- `pending`
- `running`
- `passed`
- `failed`
- `needs_fix`
- `needs_review`
- `checks_failed`
- `blocked`
- `stopped`
- `cancelled`

Suggested phase statuses:

- `pending`
- `running`
- `skipped`
- `passed`
- `failed`
- `blocked`

## Available actions model

Each run should expose safe next actions for CLI/API/dashboard consumers.

Examples:

- `continue`
- `stop`
- `request_fix`
- `run_checks`
- `generate_change_report`
- `generate_pr_summary`
- `commit`, future

Actions should be generated from run state and safety rules, not guessed by UI consumers.

## Data design principles

- Human-readable artefacts should remain easy to open directly.
- Machine-readable metadata should be stable and versioned.
- GUI/API consumers should not need to parse arbitrary Markdown to understand run state.
- Artefact paths should be relative where possible for portability.
- Sensitive provider or environment data should not be persisted unless explicitly required.
- Schema changes should include migration notes once external users depend on them.

## Open questions

- Should `run.json` become the only source of truth, or should some state continue to be derived from phase files?
- Should `events.jsonl` be append-only?
- Should a local SQLite index be added for dashboard performance, or is filesystem scanning acceptable for MVP?
- Should status names mirror current internal implementation exactly or introduce a cleaner public schema with adapters?
