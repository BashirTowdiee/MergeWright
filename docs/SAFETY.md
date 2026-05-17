# Safety Checklist

## Enforced defaults

- Codex sandbox defaults to read-only for all phases.
- `workspace-write` is allowed only for builder/fix-style execution when explicit write mode is enabled and write-safety passes.
- Planner, reviewer, review-to-fix, and reassessment prompts remain read-only/classification-only.
- Auto-push is not implemented.
- Auto-merge is not implemented.
- Auto-accept is not implemented.
- Correction-stage support is not implemented yet.

## Write-enabled execution

Write-enabled execution is explicit and gated.

Classic run workflow:

- `run` and `continue-run` support `--allow-writes` for builder/fix phases.
- Normal `run` is fail-closed for write mode: write-enabled builder/fix requires reviewer execution in the same command.
- `continue-run` may leave post-write review pending until a later reviewer continuation.

Stage Plan workflow:

- `run-stage`, `run-stages`, `continue-stages`, and `fix-stage` may use `--allow-writes` when they execute builder/fix-style stage work.
- Stage Plan commands still run at most one stage per invocation.
- Successful Stage Plan execution stops at `review_required` and does not auto-accept.
- `fix-stage` refuses committed stages and any stage with `commitSha`.

## Auto-commit boundaries

Repository commits are manual by default.

The only supported auto-commit path is:

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path> --auto-commit
```

Safety rules:

- Auto-commit is explicit opt-in.
- Auto-commit is supported only by `accept-stage --auto-commit`.
- `run-stage`, `run-stages`, and `continue-stages` reject `--auto-commit`.
- Auto-commit does not auto-accept stages.
- Auto-commit runs only after `accept-stage` accepts a `review_required` or `passed` stage.
- Commit metadata (`commitSha`) is recorded only after git commit succeeds and HEAD SHA retrieval succeeds.
- If git is unavailable, diff is empty, scope validation fails, commit fails, or SHA retrieval fails:
  - the stage is not marked `committed`
  - `commitSha` is not set
- Committed stages cannot be fixed in-place.

## Workspace and command safety

- Command checks apply denylist validation before execution.
- Configured checks are validated against safety rules before execution.
- For write-enabled classic flows, checks are blocked until post-write review is completed.
- `check-write-safety` is read-only and does not execute Codex.
- `check-write-safety` does not mutate target repo files.
- Config/project bootstrap (`init-project`) writes only inside the orchestrator repo.
- `import-stage-plan` validates and renders Stage Plan artefacts only. It does not execute Codex, checks, or git commands.

## Run artefact isolation

Classic run artefacts are written under configured `runs/<project>/...` paths.

Stage Plan artefacts are written beside the canonical `stage-plan.json`:

```text
<run-dir>/stage-plan.json
<run-dir>/stage-plan.md
<run-dir>/stages/<stage-id>/...
<run-dir>/reassessments/<source-stage-id>/revision-<revision>/...
```

Write audit artefacts are run-local under `write-audit/<phase>/` where applicable.
Post-write review gate artefacts are run-local:

- `post-write-review-required.json`
- `post-write-review-status.json`

## Stage Plan review gates

- `run-stage` runs one selected stage and stops at `review_required`.
- `run-stages --stop-after-each-stage` runs the next linear stage and stops at `review_required`.
- `continue-stages` runs one next stage only after earlier gates are satisfied.
- `continue-stages` refuses to continue when any stage is `review_required`.
- `continue-stages` refuses `needs_revision` and `invalidated` stages.
- Reassessment is classification-only and does not implement code or rewrite stage definitions.
- `needs_revision` and `invalidated` block continuation until the plan is updated manually or replaced.

## Dry-run behaviour

- `--dry-run` performs dependency/flag validation and prints projected actions.
- Dry-run does not execute Codex.
- Dry-run does not run checks.
- Stage Plan dry-run does not mutate `stage-plan.json` and does not create stage artefacts for stage progression.

## Classic auto-chain bounds

- Classic `run --auto-chain` retries are bounded by `--max-fix-attempts`.
- `--max-fix-attempts` is capped to integer `0..5`.
- No infinite loop is possible because each retry increments a bounded attempt counter.
- Classic auto-chain stop conditions are explicit:
  - reviewer verdict `PASS` -> checks run -> final `PASS` or `CHECKS_FAILED`
  - review-to-fix decision `PROCEED` -> checks run -> final `PASS` or `CHECKS_FAILED`
  - review-to-fix decision `FIX_REQUIRED` with writes disabled -> `NEEDS_FIX_WRITE_DISABLED`
  - review-to-fix decision `FIX_REQUIRED` with attempts exhausted -> `MAX_FIX_ATTEMPTS_REACHED`
  - review-to-fix decision `FIX_REQUIRED` with attempts remaining -> fix/reviewer retry
  - unexpected execution/parse failure -> `FAILED`
- Classic auto-chain does not commit, push, merge, or auto-accept.

## Git inspection safety

Write audit uses read-only git inspection:

- `git status --porcelain`
- `git diff --name-only`
- `git diff --stat`
- `git diff --binary`

Stage Plan auto-commit is the only path that invokes git mutation, and only after explicit `accept-stage --auto-commit`.

## Write-safety config

- `writeSafety.enabled` defaults to `false`; write mode is blocked unless explicitly set to `true`.
- `writeSafety.autoCommit` and `writeSafety.autoPush` must stay `false`; validation rejects `true`.
- Allowed branch patterns and blocked paths are validated before write-enabled builder/fix execution.
- Stage Plan auto-commit is not controlled by `writeSafety.autoCommit`; it is a separate explicit `accept-stage --auto-commit` action with its own git/scope checks.
