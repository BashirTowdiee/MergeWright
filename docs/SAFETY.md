# Safety Checklist (Stage T)

## Enforced Defaults
- Codex sandbox defaults to read-only for all phases.
- `workspace-write` is allowed only for builder/fix when `--allow-writes` is set and write-safety passes.
- No git mutation steps are orchestrated.
- Auto-commit is implemented only as explicit opt-in on `accept-stage --auto-commit`.
- `run-stage`, `run-stages`, and `continue-stages` do not auto-commit.
- Auto-commit does not auto-accept stages.
- Auto-push is not implemented.

## Workspace And Command Safety
- Target workspace writes are allowed only for builder/fix when `--allow-writes` is set.
- `--allow-writes` is only supported by `run` and `continue-run`.
- Normal `run` is fail-closed for write mode: write-enabled builder/fix requires `--execute-reviewer`.
- Command checks apply denylist validation before execution.
- For write-enabled flows, checks are blocked until post-write review is completed.
- Config/project bootstrap (`init-project`) writes only inside the orchestrator repo.

## Run Artefact Isolation
- Run artefacts are written under configured `runs/<project>/...` paths.
- Run metadata (`run.json`) is isolated per run directory.
- Write audit artefacts are written only under run-local `write-audit/<phase>/` paths.
- Post-write review gate artefacts are run-local (`post-write-review-required.json`, `post-write-review-status.json`).

## Manual Control Requirements
- Repository commits are manual by default; the only exception is explicit `accept-stage --auto-commit`.
- Repository pushes remain manual user actions.
- Auto-commit and auto-push remain disabled for run/continue workflows and write-mode config validation.
- Auto-commit is not part of planner/builder/reviewer/check phases.
- No auto-push helper/phase is present.

## Stage Plan Auto-Commit (SP-7)
- `accept-stage --auto-commit` runs only after `accept-stage` accepts a stage from `review_required` or `passed`.
- Commit metadata (`commitSha`) is recorded only after git commit succeeds and HEAD SHA retrieval succeeds.
- If git is unavailable, diff is empty, scope validation fails, commit fails, or SHA retrieval fails:
  - stage is not marked `committed`
  - `commitSha` is not set
- Committed stages cannot be fixed in-place.
- Correction-stage support is not implemented yet.

## Dry-Run Behavior
- `--dry-run` performs dependency/flag validation and writes dry-run outputs without executing Codex or configured checks.

## Auto-Chain Bounds
- Auto-chain retries are bounded by `--max-fix-attempts`.
- `--max-fix-attempts` is capped to integer `0..5` (hard max `5`).
- No infinite loop is possible because each retry increments a bounded attempt counter.
- Auto-chain stop conditions are explicit:
  - reviewer verdict `PASS` -> checks run -> final `PASS` or `CHECKS_FAILED`
  - review-to-fix decision `PROCEED` -> checks run -> final `PASS` or `CHECKS_FAILED`
  - review-to-fix decision `FIX_REQUIRED` with writes disabled -> `NEEDS_FIX_WRITE_DISABLED`
  - review-to-fix decision `FIX_REQUIRED` with attempts exhausted -> `MAX_FIX_ATTEMPTS_REACHED`
  - review-to-fix decision `FIX_REQUIRED` with attempts remaining -> fix/reviewer retry
  - unexpected execution/parse failure -> `FAILED`
- Manual review before commit remains expected; auto-chain does not commit/push/merge.

## Write Safety Gate
- `check-write-safety` is read-only and does not execute Codex.
- `check-write-safety` does not mutate target repo files.
- Planner/reviewer/review-to-fix remain read-only even with `--allow-writes`.
- Write-audit git capture uses read-only git inspection (`status --porcelain`, `diff --name-only`, `diff --stat`, `diff --binary`) only.
- Changed-file audit includes status-derived paths (including untracked/staged-only), while patch artefacts remain tracked `git diff --binary` output.
- Write-mode config auto-commit and auto-push remain disabled.
- `writeSafety.enabled` defaults to `false`; write mode is blocked unless it is explicitly set to `true`.
- `writeSafety.autoCommit` and `writeSafety.autoPush` must stay `false`; validation rejects `true`.
- Allowed branch patterns and blocked paths are validated before builder/fix write mode executes.
