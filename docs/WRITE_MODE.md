# Write Mode

Write mode controls when Shepherds-Staff may ask Codex to modify a target workspace.

## Scope

- Write mode is opt-in via `--allow-writes`.
- Only builder/fix-style execution may run with `workspace-write`.
- Planner, reviewer, review-to-fix, and reassessment prompts remain read-only/classification-only.
- Auto-chain does not weaken or bypass write-mode rules.
- Classic auto-chain fix attempts require `--allow-writes`.

## Supported write-enabled commands

Classic workflow:

- `run` supports `--allow-writes` for builder/fix phases.
- `continue-run` supports `--allow-writes` for builder/fix phases.

Stage Plan workflow:

- `run-stage` supports `--allow-writes` for selected stage execution.
- `run-stages --stop-after-each-stage` supports `--allow-writes` for the selected next stage.
- `continue-stages` supports `--allow-writes` for the selected next stage.
- `fix-stage` supports `--allow-writes` for selected stage fix execution.

Commands that only inspect, import, accept, or reassess do not require builder/fix write mode. `accept-stage --auto-commit` is a separate explicit git action after human acceptance.

## Preconditions

- `writeSafety.enabled` must be `true` for write-enabled builder/fix execution.
- Write safety checks must pass.
- `--dry-run` never performs write-enabled execution.
- Classic `run` with write-enabled builder/fix must include reviewer execution in the same command.
- Stage Plan execution commands still stop at `review_required`; write mode does not imply acceptance or commit.

## Write audit capture

For write-enabled builder/fix execution, the orchestrator captures git state before and after phase execution and writes run-local artefacts where applicable:

- `write-audit/builder/pre-status.txt`
- `write-audit/builder/pre-diff-stat.txt`
- `write-audit/builder/pre-diff.patch`
- `write-audit/builder/pre-changed-files.json`
- `write-audit/builder/pre-untracked-files.json`
- `write-audit/builder/post-status.txt`
- `write-audit/builder/post-diff-stat.txt`
- `write-audit/builder/post-diff.patch`
- `write-audit/builder/post-changed-files.json`
- `write-audit/builder/post-untracked-files.json`
- `write-audit/builder/summary.json`
- `write-audit/fix/...` mirrors the same structure for fix execution.

`pre/post-changed-files.json` and `summary.json` changed-file fields are derived from the union of:

- `git diff --name-only` paths
- `git status --porcelain` parsed paths, including staged-only and untracked files

`pre/post-diff.patch` remain tracked diff artefacts from `git diff --binary`. Untracked/status-only files are captured in JSON because they are not represented in plain tracked diff output.

## Git inspection safety

Write audit uses read-only git inspection only:

- `git status --porcelain`
- `git diff --name-only`
- `git diff --stat`
- `git diff --binary`

No git mutation commands are used by write audit.

## Stage Plan auto-commit

SP-7 adds explicit auto-commit only for:

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path> --auto-commit
```

Boundaries:

- `run-stage`, `run-stages`, and `continue-stages` reject `--auto-commit`.
- Auto-commit does not auto-accept stages.
- Auto-commit runs only after `accept-stage` accepts a `review_required` or `passed` stage.
- Git must be available.
- Diff must be non-empty.
- Changed files must satisfy stage `scope.include` and `scope.exclude` when present.
- Commit and HEAD SHA retrieval must both succeed before `commitSha` is stored.
- Git unavailable, no-diff, scope violation, commit failure, or SHA retrieval failure do not mark the stage `committed`.

Committed stages cannot be fixed in-place. Correction-stage support is not implemented yet.

## Failure semantics

- If builder/fix execution fails in write mode, post-capture is still attempted.
- If audit capture fails, the run fails clearly.
- If both execution and audit fail, execution failure remains the primary thrown error.
- Classic `run` is fail-closed for write mode without reviewer.
- Stage Plan pre-execution failures do not mark the plan failed as an execution failure.
- Stage Plan execution-started failures can mark the selected stage and plan failed according to stage progression semantics.

## Post-write review gating

Classic write-enabled builder/fix requires a post-write reviewer gate driven by write-audit artefacts.

Metadata records `postWriteReview` with:

- `required`
- `status` (`not-required`, `pending`, `completed`, `failed`)
- `reason`
- `requiredByPhases`
- `artefacts`

Run artefacts:

- `post-write-review-required.json`
- `post-write-review-status.json`

Configured checks are valid only after post-write review is completed for write-enabled classic flows.
If `postWriteReview.status` is pending or failed, `--run-checks` is blocked and checks execution does not start.

Stage Plan commands use stage-level `review_required`, `accepted`, `needs_revision`, `invalidated`, and `committed` gates instead of classic post-write review metadata.

## Manual workflow

Classic workflow:

1. Run `check-write-safety`.
2. Run `run` or `continue-run` with `--allow-writes` for builder/fix.
3. Execute reviewer to complete post-write review.
4. Inspect write-audit artefacts.
5. Run checks with `--run-checks` when ready.
6. Commit manually.

Stage Plan workflow:

1. Import a Stage Plan.
2. Run one stage with `run-stage` or `run-stages --stop-after-each-stage`.
3. Inspect stage artefacts and diff.
4. Fix or accept the stage.
5. Reassess downstream stages when assumptions changed.
6. Continue only after gates are satisfied.
7. Commit manually, or use explicit `accept-stage --auto-commit` after human review.

Auto-push remains unsupported.

## Acceptance command examples

Classic write-enabled run:

```bash
npm run agent -- run <stage-name> --config configs/my-app.json --execute-planner --execute-builder --execute-reviewer --allow-writes
```

Classic write-enabled continuation:

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder --allow-writes
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer --run-checks
```

Stage Plan write-enabled stage:

```bash
npm run agent -- run-stage <stage-id> --stage-plan .artifacts/runs/example/stage-plan.json --config configs/my-app.json --allow-writes
```

Stage Plan accepted auto-commit:

```bash
npm run agent -- accept-stage <stage-id> --stage-plan .artifacts/runs/example/stage-plan.json --auto-commit
```
