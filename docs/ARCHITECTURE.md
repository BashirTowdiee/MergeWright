# Architecture (v1 + Stage T Write Mode + Auto-Chain)

## Overview

The standalone orchestrator is a CLI-driven execution engine that coordinates staged prompt workflows against configured repositories, while storing all run artefacts under orchestrator-managed run directories.

High-level goals:

- deterministic phase orchestration
- safe-by-default execution boundaries
- auditable run outputs and metadata
- resumable (continuation) phase execution

## High-Level System Architecture

```text
User CLI Command
  -> CLI Arg Parser / Validator
  -> Config Loader + Safety Validation
  -> Stage + Prompt Template Loader
  -> Phase Executor (Planner/Builder/Reviewer/Fix/Checks)
  -> Artefact Writer
  -> run.json Metadata Writer
  -> Run Inspection (list-runs/show-run/open-run)
```

Main phase flow:

```text
Planner
-> Builder Prompt Extraction
-> Builder
-> Reviewer
-> Review-to-Fix
-> Fix
-> Checks
-> Run Metadata Finalization
```

## CLI Entry Point

Primary entry point:

- `src/cli.ts`

Responsibilities:

- parse top-level and command-specific args
- validate usage and phase dependencies
- resolve presets into execution flags
- dispatch to `run`, `continue-run`, inspection, and onboarding handlers
- render user-facing summaries/help

Commands implemented:

- `run`
- `continue-run`
- `list-runs`
- `show-run`
- `open-run`
- `init-project`
- `check-write-safety`

## Config Loading

Modules:

- `src/config.ts`
- `configs/<project>.json`

Responsibilities:

- resolve config path from CLI (`--config` required)
- parse and validate JSON schema-like constraints
- enforce safety booleans (`manualCommit=true`, `forbidAutoCommit=true`, `forbidAutoPush=true`)
- validate configured checks and command safety
- validate target workspace existence and optional git repo requirement

## Prompt Templates

Module:

- `src/prompts.ts`

Template directory:

- `prompts/`

Core templates:

- `planner-stage.md`
- `reviewer.md`
- `review-to-fix.md`
- `final-review.md`

The runner renders templates using stage/context variables and writes rendered previews into run artefacts.

Reviewer prompts are evidence-focused review packets. The reviewer template prioritises the stage contract, planner summary, builder instructions summary, builder result summary, write-safety/change evidence, test results, git diff/status evidence, and a strict verdict contract. It intentionally does not replay the full rendered planner prompt or raw builder stdout/stderr by default.

Reviewer template rendering also applies deterministic per-section truncation for large evidence sections. Truncated sections include a marker with the original and retained character counts. This bounds reviewer input before execution and reduces the risk of backend input-limit failures while keeping the most relevant head/tail context.

## Stage Files

Module:

- `src/stage.ts`

Default location:

- `stages/<project>/<stage-name>.md`

`run <stage-name>` resolves this as `<stagesDir>/<stage-name>.md`. Stage names are validated to prevent traversal and invalid paths.

## Run Directory Structure

Runs are stored under:

- `runs/<project>/<run-id>/`

`<run-id>` format is timestamp + stage suffix (from runner logic). Each run holds:

- stage input snapshot
- rendered prompt previews
- execution command/stdio/exit artefacts per phase
- parse outputs/decisions
- checks outputs
- `run.json`

## Phase Execution Flow

Primary run module:

- `src/runner.ts`

Continuation module:

- `src/continue-run.ts`

Phase dependency model:

- Builder requires Planner.
- Reviewer requires Planner.
- Fix planning requires Reviewer.
- Fix execution requires Fix planning.
- Checks are independent of Codex phase outputs but controlled by flags.

Dry-run behavior:

- validates orchestration and dependency paths
- writes dry-run/skipped artefacts
- does not execute Codex
- does not execute configured checks

## Codex Wrapper

Module:

- `src/codex.ts`

Responsibilities:

- build Codex command invocation
- enforce read-only sandbox args
- capture stdout/stderr/exit and last-message output

Safety-critical point:

- v1 always includes read-only sandbox behavior for orchestrated Codex phases

## Parser Modules

Modules:

- `src/planner-output.ts`
- `src/review-to-fix-output.ts`

Responsibilities:

- parse planner outputs into builder prompt payloads
- parse review-to-fix decisions (`FIX_REQUIRED` vs `PROCEED`) and extracted fix prompt
- emit parse diagnostics artefacts when parsing fails

## Metadata System

Module:

- `src/run-metadata.ts`

`run.json` tracks:

- identity (`runId`, `projectName`, `stageName`)
- resolved options and preset
- per-phase status (`unknown|disabled|skipped|executed|failed`)
- timestamps
- artefact index
- run status (`running|success|failed`) and error summary

Metadata is updated incrementally and written atomically.

## Run Inspection

Module:

- `src/runs.ts`

CLI surfaces:

- `list-runs`: tabular summaries
- `show-run`: detailed status + artefacts + warnings
- `open-run`: macOS helper for directory open

If `run.json` is missing/malformed, inspection falls back to artefact inference and surfaces warnings.

## Continuation

`continue-run` resumes selected phases in an existing run folder with strict prerequisite checks.

Continuation rules:

- planner cannot be resumed
- already executed phases are guarded
- prerequisite artefacts must exist
- dry-run computes projected status changes without persisting execution artefacts or metadata changes

## Auto-Chain Execution

Module:

- `src/auto-chain.ts`

`run --auto-chain` orchestrates:

- initial pass (`planner -> builder -> reviewer -> review-to-fix`)
- bounded fix/reviewer retries when decision is `FIX_REQUIRED`
- checks execution on `PASS` or `PROCEED`
- terminal statuses (`PASS`, `NEEDS_FIX`, `NEEDS_FIX_WRITE_DISABLED`, `MAX_FIX_ATTEMPTS_REACHED`, `CHECKS_FAILED`, `FAILED`)

Safety bounds:

- max retries are controlled by `--max-fix-attempts` (`0..5`)
- no unbounded retry loop
- no auto-commit/push/merge

## Configured Checks

Modules:

- `src/commands.ts`
- `src/runner.ts`
- `src/continue-run.ts`

Configured checks are declared in project config and can run from `workspace` or `orchestrator` cwd. The command validator blocks dangerous patterns.

## Safety Boundaries

Current hard boundaries:

- read-only Codex sandbox by default
- write-enabled mode is explicit (`--allow-writes`) and limited to builder/fix
- planner/reviewer/review-to-fix remain read-only in all modes
- no orchestrated commit/push/merge
- write-enabled execution requires write-safety pass plus post-write review/check gating

These boundaries are enforced via config validation, command validation, write-safety checks, and runtime gating.
