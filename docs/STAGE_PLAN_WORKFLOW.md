# Stage Plan Workflow

Stage Plans turn an implementation plan into small, reviewable stages. Each stage has a goal, assumptions, acceptance criteria, checks, dependency information, and scope boundaries.

The workflow is intentionally human-gated:

1. import a validated stage plan
2. run one stage
3. inspect artefacts and code changes
4. accept or fix the stage
5. optionally reassess downstream stages
6. continue to the next stage only when gates are satisfied
7. optionally auto-commit only after explicit acceptance

Stage Plans are separate from the older single-stage `run` / `continue-run` workflow. The older `run --auto-chain` flow is still bounded and does not commit. Stage Plan auto-commit exists only on `accept-stage --auto-commit`.

## Artefact layout

Given a stage plan at:

```text
.artifacts/runs/provider-switching/stage-plan.json
```

Stage Plan artefacts are written under the same run directory:

```text
.artifacts/runs/provider-switching/
  stage-plan.json
  stage-plan.md
  stages/
    stage-01-provider-contract/
      stage.json
      stage-prompt.md
      planner-output.md
      builder-output.md
      reviewer-output.md
      checks-output.txt
      feedback.md
      stage-report.md
  reassessments/
    stage-01-provider-contract/
      revision-2/
        reassessment-prompt.md
        reassessment-result.json
        reassessment-report.md
```

## 1. Import a stage plan

```bash
npm run agent -- import-stage-plan \
  --from docs/examples/stage-plan.example.json \
  --out .artifacts/runs/provider-switching
```

This validates the source JSON and writes:

```text
.artifacts/runs/provider-switching/stage-plan.json
.artifacts/runs/provider-switching/stage-plan.md
```

The command does not execute planner, builder, reviewer, checks, or git commands.

## 2. Run the first stage and stop for review

```bash
npm run agent -- run-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --stop-after-each-stage \
  --config configs/my-app.json \
  --allow-writes
```

Current behaviour is conservative:

- `run-stages` requires `--stop-after-each-stage`
- exactly one stage runs per command
- the selected stage stops at `review_required`
- no stage is auto-accepted
- no stage is auto-committed
- a blocked earlier candidate prevents skipping ahead to later stages

For a single named stage, use:

```bash
npm run agent -- run-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --allow-writes
```

## 3. Inspect artefacts and decide

After a stage runs, inspect:

```text
.artifacts/runs/provider-switching/stages/<stage-id>/stage-report.md
.artifacts/runs/provider-switching/stages/<stage-id>/builder-output.md
.artifacts/runs/provider-switching/stages/<stage-id>/reviewer-output.md
```

Then choose one of the review actions.

## 4. Accept the stage

```bash
npm run agent -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json
```

`accept-stage` is allowed only from `review_required` or `passed`. It updates the selected stage to `accepted`, persists `stage-plan.json`, regenerates `stage-plan.md`, and updates the stage report.

It does not run planner, builder, reviewer, checks, or git commands.

## 5. Fix the stage before accepting

```bash
npm run agent -- fix-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --feedback "The provider contract still leaks OpenAI-specific message shapes." \
  --allow-writes
```

`fix-stage`:

- requires non-empty feedback
- refuses committed stages and stages with `commitSha`
- writes feedback under the stage artefact directory
- scopes the fix prompt to the selected stage only
- increments the stage revision on successful fix
- returns the stage to `review_required`
- does not continue to another stage
- does not auto-commit

## 6. Reassess downstream stages

Use reassessment when a source stage changed in a way that may invalidate later stages.

```bash
npm run agent -- reassess-stage-plan \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --from stage-01-provider-contract \
  --config configs/my-app.json
```

Reassessment is classification-only. It does not implement code and does not rewrite downstream stage definitions.

Each downstream stage is classified as:

- `unchanged`
- `needs_revision`
- `invalidated`

`needs_revision` and `invalidated` block `continue-stages` until the plan is updated manually or replaced. Correction-stage and automatic downstream stage rewriting are not implemented yet.

You can also trigger reassessment after a successful fix:

```bash
npm run agent -- fix-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --feedback "Make the provider contract vendor-neutral." \
  --reassess-downstream \
  --allow-writes
```

Reassessment does not run after failed fixes or pre-execution failures.

## 7. Continue after acceptance

```bash
npm run agent -- continue-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config configs/my-app.json \
  --allow-writes
```

`continue-stages` runs exactly one next stage and stops at `review_required`.

It refuses to continue when:

- any stage is still `review_required`
- an earlier dependency is not `accepted` or `committed`
- the next stage is `needs_revision`
- the next stage is `invalidated`

## 8. Explicit auto-commit after human acceptance

Auto-commit is supported only on `accept-stage --auto-commit`.

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

Auto-commit safety boundaries:

- it is explicit opt-in
- it does not auto-accept stages
- it runs only after `accept-stage` accepts `review_required` or `passed`
- `run-stage`, `run-stages`, and `continue-stages` reject `--auto-commit`
- git must be available
- diff must be non-empty
- changed files must satisfy `scope.include` and `scope.exclude` when present
- commit succeeds before `commitSha` is recorded
- HEAD SHA retrieval succeeds before the stage is marked `committed`
- failed git, no-diff, scope, commit, or SHA checks leave the stage accepted but not committed

Committed stages cannot be fixed in-place. A future correction-stage workflow should handle post-commit corrections.

## Dry-run behaviour

Stage Plan dry-runs validate state and print projected actions without running Codex, checks, git commits, or status mutation.

Examples:

```bash
npm run agent -- run-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --stop-after-each-stage \
  --dry-run

npm run agent -- continue-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --dry-run

npm run agent -- reassess-stage-plan \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --from stage-01-provider-contract \
  --dry-run
```

## Recommended default

Use this default loop for serious repository work:

```text
run one stage -> inspect artefacts -> fix or accept -> optionally reassess -> continue
```

Use `accept-stage --auto-commit` only after reviewing the diff and artefacts.
