# Product Requirements

## Purpose

This document defines the product requirements for Shepherds-Staff as a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.

## Product goals

- Provide a structured workflow for AI-assisted software changes.
- Keep developers in control of risky decisions.
- Preserve durable artefacts for every important phase.
- Support safe read-only planning and review by default.
- Support explicit, gated write execution.
- Make runs inspectable, resumable, and reportable.
- Prepare the product for future GUI, provider abstraction, and editor surfaces.

## Non-goals

- Hosted SaaS execution.
- Multi-user collaboration.
- Cloud run history.
- Auto-push or auto-merge.
- Unbounded autonomous coding.
- Full IDE replacement.
- Enterprise admin management.

## User personas

### Power user developer

A senior developer who uses AI coding tools and wants stronger structure, safety, and repeatability.

### Technical lead

A lead who wants AI-generated changes to be reviewable, traceable, and easy to explain.

### Open-source maintainer

A maintainer who wants to use AI assistance without losing control of repository quality.

## Core workflows

### Initialise a project

The user can configure Shepherds-Staff for a target repository and create starter stage scaffolding.

Requirements:

- Validate target workspace path.
- Validate git repository requirement where applicable.
- Create local project config.
- Create stage directory.
- Avoid writing into the target repository during onboarding unless explicitly supported later.

### Run a stage

The user can run a stage through one or more orchestration phases.

Requirements:

- Support dry-run preview.
- Support plan-only execution.
- Support builder execution.
- Support reviewer execution.
- Support fix-planning and fix execution.
- Persist prompts, logs, outputs, exit codes, and metadata.
- Preserve safety boundaries for each phase.

### Continue a run

The user can continue an existing run without losing prior context.

Requirements:

- Locate existing run metadata.
- Determine completed, failed, skipped, and pending phases.
- Allow continuation from valid states.
- Block unsafe continuation when required review or checks are missing.

### Run auto-chain

The user can run a bounded decision-driven workflow from one command.

Requirements:

- Support planner, builder, reviewer, review-to-fix, fix, retry review, and checks.
- Support bounded fix attempts.
- Prevent infinite loops.
- Record auto-chain decisions in machine-readable metadata.
- Stop safely when writes are required but disabled.
- Preserve manual git actions unless controlled commit support is explicitly added later.

### Generate reports

The user can generate product-quality summaries of completed runs.

Requirements:

- Generate change reports.
- Generate PR summaries.
- Classify file changes and risk where supported.
- Preserve original run failure clarity if report generation fails.

## Functional requirements

### Project configuration

- The system must support project-specific config files.
- The system must support target workspace configuration.
- The system must support stage directories.
- The system should support provider configuration in future.

### Stage management

- The system must accept stage instructions as Markdown.
- The system should support deterministic prompt rendering.
- The system should allow stages to be run independently.

### Phase execution

- The system must model distinct phases.
- The system must enforce phase ordering where required.
- The system must capture phase artefacts.
- The system must expose phase status through run metadata.

### Safety model

- The system must default to read-only execution.
- Write execution must be explicit.
- Write-enabled phases must be limited to builder and fix phases unless changed by a documented decision.
- Planner and reviewer phases must remain read-only.
- Write-safety checks must pass before write-enabled execution.
- Post-write review must be required before checks.

### Artefacts

- The system must persist run artefacts to disk.
- The system must write machine-readable metadata for run state.
- The system should maintain an artefact index for GUI/API consumption.
- The system should preserve human-readable Markdown outputs.

### Run inspection

- The system must allow users to list runs.
- The system must allow users to inspect a run.
- The system should expose phase state, artefact paths, checks, report paths, and final status.

### Provider support

- The system currently supports Codex execution.
- The product should move toward a provider-agnostic contract.
- Provider-specific behaviour should be isolated behind adapters.

## Non-functional requirements

### Reliability

- Failure states must be explicit.
- Partial artefact writes should be avoided where practical.
- Commands should fail closed when safety requirements are not met.

### Auditability

- Every important phase must leave a durable record.
- Write-enabled execution must capture pre/post audit information.
- The user should be able to reconstruct what happened in a run.

### Usability

- CLI output should clearly show progress and final status.
- Dry-run output should explain what would happen.
- Errors should state the reason and next safe action.

### Maintainability

- CLI, API, and GUI surfaces should reuse the same orchestration core.
- Product state should be structured enough for future UI surfaces.
- Safety rules should remain centralised and testable.

## Acceptance criteria

- A user can initialise a project and run a safe dry-run stage.
- A user can execute a staged workflow and inspect generated artefacts.
- A user can run auto-chain with bounded fix attempts.
- A user can generate a change report or PR summary from a completed run.
- Write mode is blocked unless safety requirements pass.
- Failed phases produce clear status and artefacts.
- Existing CLI workflows remain scriptable.
