# Safety Checklist (Stage T)

## Enforced Defaults
- Codex sandbox defaults to read-only for all phases.
- `workspace-write` is allowed only for builder/fix when `--allow-writes` is set and write-safety passes.
- No git mutation steps are orchestrated.
- Auto-commit is not implemented.
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
- Repository commits remain manual user actions.
- Repository pushes remain manual user actions.
- Auto-commit and auto-push remain disabled by policy and config validation.
- No auto-commit helper/phase is present.
- No auto-push helper/phase is present.

## Dry-Run Behavior
- `--dry-run` performs dependency/flag validation and writes dry-run outputs without executing Codex or configured checks.

## Write Safety Gate
- `check-write-safety` is read-only and does not execute Codex.
- `check-write-safety` does not mutate target repo files.
- Planner/reviewer/review-to-fix remain read-only even with `--allow-writes`.
- Write-audit git capture uses read-only git inspection (`status --porcelain`, `diff --name-only`, `diff --stat`, `diff --binary`) only.
- Changed-file audit includes status-derived paths (including untracked/staged-only), while patch artefacts remain tracked `git diff --binary` output.
- Auto-commit and auto-push remain disabled.
- `writeSafety.enabled` defaults to `false`; write mode is blocked unless it is explicitly set to `true`.
- `writeSafety.autoCommit` and `writeSafety.autoPush` must stay `false`; validation rejects `true`.
- Allowed branch patterns and blocked paths are validated before builder/fix write mode executes.
