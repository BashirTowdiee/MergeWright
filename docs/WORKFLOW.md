# Workflow Guide

This guide covers the two supported Shepherds-Staff workflows:

1. the classic single-stage `run` / `continue-run` workflow
2. the Stage Plan workflow for multi-stage, human-gated delivery

## Classic run workflow

Use the classic workflow when you have one stage file and want Planner -> Builder -> Reviewer orchestration with optional bounded fix attempts.

### 1. Create project scaffolding

```bash
npm run agent -- init-project "My App" --workspace /path/to/repo
```

This creates orchestrator-side files only:

```text
configs/my-app.json
stages/my-app/example-stage.md
runs/my-app/.gitkeep
```

### 2. Create a stage file

Example:

```text
stages/my-app/stage-01-example.md
```

Stage names map to filenames without `.md`, so this stage is referenced as `stage-01-example`.

### 3. Preview or run phases

Plan only:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
```

Full read-only preview:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset full-readonly --dry-run
```

Bounded auto-chain:

```bash
npm run agent -- run stage-01-example \
  --config configs/my-app.json \
  --auto-chain \
  --allow-writes \
  --max-fix-attempts 2
```

Classic `run --auto-chain` is bounded. It does not auto-commit, auto-push, auto-merge, or auto-accept changes. Auto-chain terminal statuses include: `PASS`, `NEEDS_FIX`, `NEEDS_FIX_WRITE_DISABLED`, `MAX_FIX_ATTEMPTS_REACHED`, `CHECKS_FAILED`, `FAILED`.

### 4. Inspect and continue

```bash
npm run agent -- list-runs --config configs/my-app.json
npm run agent -- show-run <run-id> --config configs/my-app.json
npm run agent -- open-run <run-id> --config configs/my-app.json
```

Continue selected phases:

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer
npm run agent -- continue-run <run-id> --config configs/my-app.json --run-checks
```

Generate an AI Change Report:

```bash
npm run agent -- report-run <run-id> --config configs/my-app.json --pr-summary
```

## Stage Plan workflow

Use Stage Plans when an implementation plan should be split into multiple controlled stages.

Stage Plan flow:

```text
import plan -> run one stage -> review -> accept or fix -> reassess if needed -> continue
```

### 1. Import a stage plan

```bash
npm run agent -- import-stage-plan \
  --from docs/examples/stage-plan.example.json \
  --out .artifacts/runs/provider-switching
```

This writes:

```text
.artifacts/runs/provider-switching/stage-plan.json
.artifacts/runs/provider-switching/stage-plan.md
```

No planner, builder, reviewer, checks, or git commands run during import.

### 2. Run one stage and stop

Run the next linear stage:

```bash
npm run agent -- run-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --stop-after-each-stage \
  --config configs/my-app.json \
  --allow-writes
```

Or run one selected stage:

```bash
npm run agent -- run-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --allow-writes
```

Current Stage Plan progression is conservative:

- one command runs at most one stage
- successful execution stops at `review_required`
- no stage is auto-accepted
- `run-stages` requires `--stop-after-each-stage`
- blocked earlier stages prevent skipping ahead

### 3. Inspect artefacts

Primary artefacts:

```text
.artifacts/runs/provider-switching/stages/<stage-id>/stage-report.md
.artifacts/runs/provider-switching/stages/<stage-id>/stage-prompt.md
.artifacts/runs/provider-switching/stages/<stage-id>/builder-output.md
.artifacts/runs/provider-switching/stages/<stage-id>/reviewer-output.md
```

### 4. Accept the stage

```bash
npm run agent -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json
```

`accept-stage` only accepts stages from `review_required` or `passed`. It does not execute Codex, checks, or git commands unless `--auto-commit` is also provided.

### 5. Fix before accepting

```bash
npm run agent -- fix-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --feedback "The provider contract still leaks OpenAI-specific message shapes." \
  --allow-writes
```

`fix-stage` refuses committed stages and stages with `commitSha`. On successful fix it increments the revision and returns the stage to `review_required`.

### 6. Reassess downstream stages

```bash
npm run agent -- reassess-stage-plan \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --from stage-01-provider-contract \
  --config configs/my-app.json
```

Reassessment classifies downstream stages only:

- `unchanged`
- `needs_revision`
- `invalidated`

It does not implement code and does not rewrite stage definitions. `needs_revision` and `invalidated` block continuation.

After a successful fix, reassess in the same command:

```bash
npm run agent -- fix-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --feedback "Make the provider contract vendor-neutral." \
  --reassess-downstream \
  --allow-writes
```

### 7. Continue after gates pass

```bash
npm run agent -- continue-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --allow-writes
```

`continue-stages` refuses to run when:

- any stage is `review_required`
- a dependency is not `accepted` or `committed`
- the next stage is `needs_revision`
- the next stage is `invalidated`

### 8. Explicit auto-commit after acceptance

```bash
npm run agent -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --auto-commit
```

Optional custom commit message:

```bash
npm run agent -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --auto-commit \
  --commit-message "stage(provider-contract): add provider-neutral contract"
```

Auto-commit boundaries:

- only supported by `accept-stage --auto-commit`
- does not auto-accept stages
- `run-stage`, `run-stages`, and `continue-stages` reject `--auto-commit`
- git must be available
- diff must be non-empty
- changed files must pass stage scope validation
- commit and HEAD SHA retrieval must both succeed before `commitSha` is stored
- failed git/no-diff/scope/commit/SHA checks leave the stage accepted but not committed

Committed stages cannot be fixed in-place. Correction-stage support is not implemented yet.

## Dry-run usage

Use `--dry-run` to validate command intent without execution or mutation.

Examples:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
npm run agent -- run-stages --stage-plan .artifacts/runs/provider-switching/stage-plan.json --stop-after-each-stage --dry-run
npm run agent -- continue-stages --stage-plan .artifacts/runs/provider-switching/stage-plan.json --dry-run
npm run agent -- reassess-stage-plan --stage-plan .artifacts/runs/provider-switching/stage-plan.json --from stage-01-provider-contract --dry-run
```

## Recommended defaults

For classic stages:

1. run dry-run first
2. use explicit phases or presets
3. inspect artefacts
4. run checks
5. commit manually

For Stage Plans:

1. import a validated plan
2. run one stage
3. inspect artefacts and diff
4. fix or accept
5. reassess downstream stages when assumptions changed
6. continue only when gates are satisfied
7. use `accept-stage --auto-commit` only after human review
