# Product Requirements

## Status

Proposed requirements. Requirements marked Current are already represented by the existing CLI. Requirements marked Proposed or Future need implementation planning before they should be treated as committed scope.

## Purpose

This document defines the product requirements for MergeWright as a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.

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

## Requirement levels

- P0: Required to preserve the current product promise.
- P1: Required for the next product maturity phase.
- P2: Useful after the core product model is stable.
- Future: Not part of the current delivery scope.

## Core workflows

### Initialise a project, Current, P0

The user can configure MergeWright for a target repository and create starter stage scaffolding.

Requirements:

- Validate target workspace path.
- Validate git repository requirement where applicable.
- Create local project config.
- Create stage directory.
- Avoid writing into the target repository during onboarding unless explicitly supported later.

### Run a stage, Current, P0

The user can run a stage through one or more orchestration phases.

Requirements:

- Support dry-run preview.
- Support plan-only execution.
- Support builder execution.
- Support reviewer execution.
- Support fix-planning and fix execution.
- Persist prompts, logs, outputs, exit codes, and metadata.
- Preserve safety boundaries for each phase.

### Continue a run, Current, P0

The user can continue an existing run without losing prior context.

Requirements:

- Locate existing run metadata.
- Determine completed, failed, skipped, and pending phases.
- Allow continuation from valid states.
- Block unsafe continuation when required review or checks are missing.

### Run auto-chain, Current, P0

The user can run a bounded decision-driven workflow from one command.

Requirements:

- Support planner, builder, reviewer, review-to-fix, fix, retry review, and checks.
- Support bounded fix attempts.
- Prevent infinite loops.
- Record auto-chain decisions in machine-readable metadata.
- Stop safely when writes are required but disabled.
- Preserve manual git actions unless controlled commit support is explicitly added later.

### Generate reports, Current, P0

The user can generate product-quality summaries of completed runs.

Requirements:

- Generate change reports.
- Generate PR summaries.
- Classify file changes and risk where supported.
- Preserve original run failure clarity if report generation fails.

### Inspect runs from a local dashboard, Proposed, P1

The user can inspect existing run history from a local dashboard.

Requirements:

- List configured projects.
- List runs for a project.
- Show run status.
- Show phase status.
- Show artefacts.
- Show change reports where present.
- Avoid execution controls in the first dashboard slice unless the API contract is ready.

### Start and control runs from a dashboard, Proposed, P2

The user can start and control runs from the dashboard.

Requirements:

- Start a dry-run.
- Start a read-only run.
- Start write-enabled execution only with explicit confirmation.
- Continue a valid stopped run.
- Stop an active run.
- Request a fix where the run state allows it.
- Preserve all CLI safety gates.

### Switch providers, Proposed, P2

The user can select an execution provider without changing the orchestration model.

Requirements:

- Define a provider-neutral execution contract.
- Keep provider-specific flags and capabilities isolated.
- Surface provider/model metadata in run artefacts.
- Avoid changing safety semantics per provider unless explicitly documented.

## Functional requirements

### Project configuration

- P0: The system must support project-specific config files.
- P0: The system must support target workspace configuration.
- P0: The system must support stage directories.
- P2: The system should support provider configuration.

### Stage management

- P0: The system must accept stage instructions as Markdown.
- P0: The system should support deterministic prompt rendering.
- P0: The system should allow stages to be run independently.
- P1: The system should expose stage metadata for API and dashboard surfaces.

### Phase execution

- P0: The system must model distinct phases.
- P0: The system must enforce phase ordering where required.
- P0: The system must capture phase artefacts.
- P1: The system must expose phase status through stable run metadata.

### Safety model

- P0: The system must default to read-only execution.
- P0: Write execution must be explicit.
- P0: Write-enabled phases must be limited to builder and fix phases unless changed by a documented decision.
- P0: Planner and reviewer phases must remain read-only.
- P0: Write-safety checks must pass before write-enabled execution.
- P0: Post-write review must be required before checks.
- P2: Controlled commit support may be added only after explicit approval and safety design.

### Artefacts

- P0: The system must persist run artefacts to disk.
- P0: The system must write machine-readable metadata for run state.
- P1: The system should maintain an artefact index for GUI/API consumption.
- P0: The system should preserve human-readable Markdown outputs.
- P1: The system should write structured events for lifecycle transitions.

### Run inspection

- P0: The system must allow users to list runs.
- P0: The system must allow users to inspect a run.
- P1: The system should expose phase state, artefact paths, checks, report paths, final status, and available next actions.

### Provider support

- P0: The system currently supports Codex execution.
- P2: The product should move toward a provider-agnostic contract.
- P2: Provider-specific behaviour should be isolated behind adapters.

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
- Dashboard surfaces should show next available actions rather than forcing users to infer state from logs.

### Maintainability

- CLI, API, and GUI surfaces should reuse the same orchestration core.
- Product state should be structured enough for future UI surfaces.
- Safety rules should remain centralised and testable.

## Acceptance criteria

### Current CLI acceptance

- A user can initialise a project and run a safe dry-run stage.
- A user can execute a staged workflow and inspect generated artefacts.
- A user can run auto-chain with bounded fix attempts.
- A user can generate a change report or PR summary from a completed run.
- Write mode is blocked unless safety requirements pass.
- Failed phases produce clear status and artefacts.
- Existing CLI workflows remain scriptable.

### Product maturity acceptance

- Run metadata is stable enough for CLI, API, and dashboard consumers.
- Artefacts can be indexed without parsing arbitrary Markdown.
- Lifecycle events can be rendered as a timeline.
- API/dashboard layers can reuse orchestration services rather than shelling out to the CLI for all behaviour.

## Traceability

| Product goal | Requirements |
| --- | --- |
| Safer AI-assisted changes | Safety model, write-safety checks, post-write review |
| Repeatable workflows | Stage management, phase execution, auto-chain |
| Auditability | Artefacts, run inspection, reports, lifecycle events |
| Future GUI/API support | Stable run metadata, artefact index, local API contract |
| Provider flexibility | Provider contract, provider metadata, adapter isolation |
