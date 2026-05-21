# MergeWright

`mergewright` is a standalone CLI delivery harness for controlled AI-assisted engineering workflows. It turns agent-generated code changes into staged, reviewable, auditable delivery evidence.

It supports Planner -> Builder -> Reviewer workflows, bounded fix loops, write-safety gates, run artefacts, AI Change Reports, and Stage Plans for human-gated multi-stage delivery.

<p align="center">
  <img src="./assets/repoImage.png" alt="MergeWright delivery harness overview" width="900" />
</p>
<p align="center"><em>Structured, auditable orchestration for planner, builder, reviewer, stage plans, bounded fix workflows, and merge-readiness evidence.</em></p>

## Documentation

Start here:

| Area | Link |
| --- | --- |
| Product direction | [Delivery harness roadmap](docs/roadmap/delivery-harness.md) |
| Architecture | [Architecture overview](docs/architecture/overview.md) |
| CLI | [Command reference](docs/cli/commands.md) |
| Workflows | [Classic run](docs/workflows/classic-run.md), [Stage Plan](docs/workflows/stage-plan.md) |
| Configuration | [Execution backends](docs/configuration/execution-backends.md) |
| Safety | [Write safety](docs/safety/write-safety.md), [Write mode](docs/safety/write-mode.md) |
| Prompting and operations | [Prompting](docs/PROMPTING.md), [Operations](docs/OPERATIONS.md) |
| Acceptance history | [V1 acceptance](docs/V1_ACCEPTANCE.md), [V2 acceptance](docs/V2_ACCEPTANCE.md) |

## Product position

MergeWright is not trying to be the agent that writes the most code or the runtime that launches the most workers. It sits above coding agents and focuses on delivery confidence.

Core promise:

> Turn AI coding work into reviewable, auditable, merge-ready software changes.

Coding agents generate work. MergeWright governs the delivery path around that work:

```text
intent -> plan -> implementation -> review -> fix loop -> checks -> evidence -> change report -> PR-ready summary
```

This keeps the project focused on trust, repeatability, evidence, and human-controlled acceptance rather than generic agent orchestration.

## What it solves

Manual LLM-assisted development breaks down when prompts, phase ordering, review gates, and artefacts are handled ad hoc. MergeWright standardises that process by:

- enforcing phase and stage dependencies
- generating consistent prompts from structured context
- storing run, stage, review, reassessment, and report artefacts
- supporting read-only previews before write-enabled execution
- keeping human review gates explicit
- collecting evidence before declaring work acceptable
- allowing optional auto-commit only after explicit stage acceptance

## Delivery harness principles

MergeWright optimises for merge confidence:

1. **Evidence first**: diff, checks, git state, review findings, and acceptance criteria should outrank agent summaries.
2. **Deterministic gates**: stages should only pass when required evidence exists and required checks have run.
3. **Human-gated acceptance**: write execution, fix loops, and commits remain explicit and inspectable.
4. **Backend-agnostic execution**: Codex, Claude Code, OpenCode, CAO, or other runners should be interchangeable execution backends.
5. **Audit-ready output**: every meaningful run should leave enough context to understand what changed, why it changed, how it was checked, and whether it is safe to merge.

## Quick start

Install dependencies and check the CLI:

```bash
npm install
npm run build
npm run mergewright -- --help
```

Create project scaffolding:

```bash
npm run mergewright -- init-project "My App" \
  --workspace /path/to/repo
```

Validate write readiness:

```bash
npm run mergewright -- check-write-safety \
  --config configs/my-app.json
```

## Common commands

### Preview a classic stage

```bash
npm run mergewright -- run stage-01-example \
  --config configs/my-app.json \
  --preset plan \
  --dry-run
```

### Run a classic stage with bounded fixes

```bash
npm run mergewright -- run stage-01-example \
  --config configs/my-app.json \
  --auto-chain \
  --allow-writes \
  --max-fix-attempts 2
```

### Continue an existing run

```bash
npm run mergewright -- continue-run <run-id> \
  --config configs/my-app.json \
  --execute-reviewer \
  --run-checks
```

### Inspect run artefacts

```bash
npm run mergewright -- list-runs \
  --config configs/my-app.json

npm run mergewright -- show-run <run-id> \
  --config configs/my-app.json

npm run mergewright -- open-run <run-id> \
  --config configs/my-app.json
```

### Generate an AI Change Report

```bash
npm run mergewright -- report-run <run-id> \
  --config configs/my-app.json \
  --pr-summary
```

## Stage Plan workflow

Use Stage Plans when you want to turn an implementation plan into reviewable stages, run one stage at a time, fix stages with human feedback, reassess downstream stages, and optionally commit only after explicit acceptance.

### Import a stage plan

```bash
npm run mergewright -- import-stage-plan \
  --from docs/examples/stage-plan.example.json \
  --out .artifacts/runs/provider-switching
```

### Run the next stage and stop for review

```bash
npm run mergewright -- run-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --stop-after-each-stage \
  --config configs/my-app.json \
  --allow-writes
```

### Fix a stage using human feedback

```bash
npm run mergewright -- fix-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --feedback "The provider contract still leaks vendor-specific message shapes." \
  --allow-writes
```

### Accept a reviewed stage

```bash
npm run mergewright -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json
```

### Accept and commit a reviewed stage

```bash
npm run mergewright -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --auto-commit
```

### Reassess downstream stages

```bash
npm run mergewright -- reassess-stage-plan \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --from stage-01-provider-contract \
  --config configs/my-app.json
```

### Continue after gates pass

```bash
npm run mergewright -- continue-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --allow-writes
```

For the full guide, see [Stage Plan workflow](docs/workflows/stage-plan.md).

## Workflow summaries

### Classic run workflow

Use `run` and `continue-run` when you want to execute a single stage file through fixed phases or bounded auto-chain control flow.

Classic `run --auto-chain` is bounded and does not commit, push, merge, or auto-accept changes.

Final statuses:

- `PASS`: reviewer passed and checks passed when checks were requested.
- `NEEDS_FIX`: reviewer or checks found issues that need another pass.
- `NEEDS_FIX_WRITE_DISABLED`: a fix was required but write execution was not enabled.
- `MAX_FIX_ATTEMPTS_REACHED`: bounded fix attempts were exhausted.
- `CHECKS_FAILED`: configured checks failed after implementation or fix work.
- `FAILED`: execution failed before a controlled terminal status could be reached.

### Stage Plan workflow

Use Stage Plans when you want stronger human gates and multi-stage control.

`accept-stage --auto-commit` is the only supported auto-commit path. `run-stage`, `run-stages`, and `continue-stages` reject `--auto-commit` because they stop at `review_required` and do not auto-accept work.

## Stage Plan command summary

| Command | Purpose |
| --- | --- |
| `import-stage-plan` | Validate an existing Stage Plan JSON and render canonical JSON/Markdown artefacts. |
| `run-stage` | Run one selected stage and stop at `review_required`. |
| `run-stages --stop-after-each-stage` | Run the next linear stage only and pause for review. |
| `accept-stage` | Mark a reviewed stage as accepted. |
| `accept-stage --auto-commit` | Commit accepted stage changes and store `commitSha`. |
| `fix-stage` | Apply human feedback to one uncommitted stage and return it to review. |
| `reassess-stage-plan` | Classify downstream stages as `unchanged`, `needs_revision`, or `invalidated`. |
| `continue-stages` | Continue to the next stage only after required gates are satisfied. |

## Safety model

- Codex execution is read-only by default.
- `--allow-writes` enables workspace-write only for builder/fix execution after write-safety passes.
- Planner, reviewer, and review-to-fix stay read-only even when writes are enabled.
- Write-enabled builder/fix runs capture pre/post git audit artefacts.
- Checks are blocked until required post-write review gates complete.
- Classic `run --auto-chain` never commits, pushes, merges, or auto-accepts.
- Stage Plan auto-commit exists only as explicit `accept-stage --auto-commit` after human acceptance.
- Failed git, no-diff, scope, commit, or SHA checks do not mark a stage committed.
- Committed stages cannot be fixed in place. Correction-stage support is not implemented yet.

For details, see [Write safety](docs/safety/write-safety.md) and [Write mode](docs/safety/write-mode.md).

## Recommended operating model

For classic stage files:

1. create a small stage file
2. run a dry run
3. run planner, builder, and reviewer with explicit flags or a preset
4. inspect artefacts
5. run checks
6. commit manually

For Stage Plans:

1. import a validated stage plan
2. run one stage
3. inspect artefacts and diff
4. fix or accept the stage
5. reassess downstream stages when source assumptions changed
6. continue only after gates pass
7. optionally use `accept-stage --auto-commit` after human review
