# Architecture Overview

MergeWright is a local-first AI software delivery harness for controlled, auditable engineering workflows.

The web app is the primary human interface. The CLI remains the scriptable automation surface. Both must use shared application/workflow logic through a stable API/service boundary rather than duplicating orchestration logic in UI clients.

MergeWright coordinates phase/stage execution, captures auditable artefacts, and turns agent-generated work into reviewable delivery evidence. The architecture should optimise for merge confidence rather than generic agent runtime breadth.

## Core model

Current high-level operator model:

```text
Web app -> Fastify API -> application services -> workflow/domain -> adapters
CLI     -> application services -> workflow/domain -> adapters
```

Target delivery-harness flow:

```text
intent
  -> stage contract
  -> planner
  -> builder
  -> reviewer
  -> fixer when required
  -> checks
  -> evidence manifest
  -> merge-readiness evaluation
  -> change report
  -> PR-ready summary
```

## Architectural boundaries

### CLI layer

Responsible for:

- parsing command arguments
- loading config
- selecting workflow commands
- presenting terminal output
- returning deterministic exit codes

The CLI should not own delivery policy. It should call use-case level functions that can also be tested directly.

### API layer

Responsible for:

- typed HTTP boundaries for web clients
- request validation and response shaping
- invoking application services/use cases
- deterministic API-level status and error behavior

Fastify routes should not embed orchestration policy. The API should remain a transport boundary over shared application/workflow logic.

### Web UI layer

Responsible for:

- run and stage supervision UX
- evidence, report, and blocker visualization
- safe next-action and approval interactions
- local UI state, filters, and view composition

The web app must not shell out to CLI commands or parse CLI/TUI terminal output as product state.

### Workflow orchestration layer

Responsible for:

- classic run phase sequencing
- Stage Plan sequencing
- bounded fix loops
- human-gated stage acceptance
- reassessment flow
- continuation rules

This layer decides what happens next. It should not know provider-specific execution details beyond the executor contract.

### Executor layer

Responsible for:

- running external coding agents or command backends
- capturing stdout/stderr
- returning exit status
- declaring backend capabilities

Executor implementations should be replaceable. Codex, OpenCode, Claude Code, CAO, or other tools should be execution backends, not the centre of the product model.

### Safety layer

Responsible for:

- write-mode validation
- git state checks
- pre/post write audit capture
- preventing unsafe auto-commit behaviour
- enforcing human-gated acceptance paths

Safety policy should remain independent from any one agent backend.

### Evidence layer

Responsible for:

- run and stage artefact paths
- git status before/after
- changed file lists
- diffs
- command outputs
- check results
- reviewer verdicts
- fix-loop history
- report inputs

The evidence layer is the long-term centre of the architecture. Reports, prove-style commands, reviewer prompts, and PR summaries should read from structured evidence rather than scraping unrelated loose files where possible.

### Review layer

Responsible for:

- evidence-first reviewer prompt construction
- structured verdict parsing
- finding classification
- acceptance criteria mapping
- fix prompt generation

Reviewer output should be treated as a formal gate. Prose can be useful, but machine-readable findings and criteria results should drive follow-up actions.

### Reporting layer

Responsible for:

- AI Change Reports
- PR summaries
- risk summaries
- merge-readiness output
- missing-evidence disclosure

Reports should never overclaim. If tests did not run, checks are missing, or review evidence is unavailable, the report should say so explicitly.

### Legacy TUI layer

The TUI path is legacy/superseded product surface. Keep compatibility while needed for migration, but do not add new product feature investment to `src/tui/**`.

## Evidence-first priority order

When deciding whether a change is acceptable, the system should prefer direct evidence in this order:

1. git diff
2. check/test/typecheck/lint output
3. changed file list and scope classification
4. stage contract and acceptance criteria
5. reviewer findings
6. fix-loop history
7. planner/builder summaries

Planner and builder summaries help explain intent, but they should not override concrete evidence.

## Stage contracts

A stage should evolve from a loose prompt into an enforceable contract.

A contract may define:

- objective
- allowed paths
- forbidden paths
- required commands
- required evidence
- acceptance criteria
- review checklist
- commit policy

The runner should store the active contract with run artefacts so later reports and reassessments can evaluate what was actually required.

## Merge-readiness evaluation

The target architecture should support deterministic merge-readiness decisions.

A run or stage should fail readiness when:

- required checks did not run
- required checks failed
- reviewer verdict failed
- required evidence is missing
- forbidden paths changed
- out-of-scope files changed under a fail policy
- write-safety artefacts are missing for write-enabled runs
- acceptance criteria are unverified or failed

This evaluator should be testable without invoking an AI agent.

## Backend strategy

MergeWright should remain backend-agnostic.

Backend runners should be responsible for execution only:

```text
prompt in -> process execution -> stdout/stderr/status out
```

MergeWright should remain responsible for:

- contracts
- sequencing
- safety gates
- evidence collection
- review policy
- merge-readiness decisions
- reports

This allows future integration with stronger runtimes without giving up the delivery harness model.

## Roadmap reference

See `docs/roadmap/delivery-harness.md` for the detailed implementation plan.
