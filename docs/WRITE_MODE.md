# Write Mode (Stage T)

## Scope
- Write mode is opt-in via `--allow-writes`.
- Only builder and fix execution phases may run with `workspace-write`.
- Planner, reviewer, and review-to-fix always remain read-only.
- Auto-chain does not weaken or bypass write-mode rules.
- Auto-chain fix attempts require `--allow-writes`.

## Preconditions
- `writeSafety.enabled` must be `true`.
- Write safety checks must pass.
- `--dry-run` never performs write-enabled execution.
- Normal `run` with write-enabled builder/fix must include `--execute-reviewer` in the same command.
- Terminal progress logs show write-safety and write-audit checkpoints in real time.

## Write Audit Capture
For write-enabled builder/fix execution, the orchestrator captures git state before and after phase execution and writes run-local artefacts:

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
- `git status --porcelain` parsed paths (including staged-only and untracked files)

`pre/post-diff.patch` remain tracked diff artefacts from `git diff --binary`. Untracked/status-only files are captured in JSON (`*-untracked-files.json`, `summary.json` status-only/untracked fields) because they are not represented in plain tracked diff output.

## Git Inspection Safety
Write audit uses read-only git inspection only:

- `git status --porcelain`
- `git diff --name-only`
- `git diff --stat`
- `git diff --binary`

No git mutation commands are used.

## Failure Semantics
- If builder/fix execution fails in write mode, post-capture is still attempted.
- If audit capture fails, the run fails clearly.
- If both execution and audit fail, execution failure remains the primary thrown error.
- Normal `run` is fail-closed for write mode without reviewer: `--allow-writes requires --execute-reviewer for post-write review`.

## Post-Write Review Gating
- Write-enabled builder/fix requires a post-write reviewer gate driven by write-audit artefacts.
- Metadata (`run.json`) records `postWriteReview` with:
  - `required`
  - `status` (`not-required`, `pending`, `completed`, `failed`)
  - `reason`
  - `requiredByPhases` (`builder` and/or `fixExecution`)
  - `artefacts`
- Run artefacts:
  - `post-write-review-required.json`
  - `post-write-review-status.json`
- `continue-run` may leave post-write review pending after a write-enabled builder/fix continuation; a later `continue-run --execute-reviewer` completes the gate.
- Reviewer prompts include write-audit context when available (write-enabled phases, changed files, and write-audit summary/diff/patch artefact paths).
- Configured checks are valid only after post-write review is completed for write-enabled flows.
- If `postWriteReview.status` is pending or failed, `--run-checks` is blocked and checks execution does not start.
- `continue-run --execute-reviewer --run-checks` is supported; checks run after reviewer succeeds in the same command.
- The same post-write review and checks gating rules apply to auto-chain write-enabled fix attempts.

## Manual Workflow
1. Run `check-write-safety`.
2. Run `run` or `continue-run` with `--allow-writes` for builder/fix.
3. Execute reviewer to complete post-write review.
4. Inspect `write-audit/<phase>/summary.json` and patch artefacts.
5. Run checks with `--run-checks` when ready.
6. Commit manually (and push manually if desired).

Note: full Codex stdout/stderr remains in run artefacts (`*-stdout.log`, `*-stderr.log`). Streaming is off by default; use `--stream-codex` to view live raw Codex output while preserving artefacts.

Auto-commit and auto-push are intentionally unsupported.

## V2 Acceptance Commands
- Normal write-enabled run (fail-closed with reviewer):
  - `npm run agent -- run <stage-name> --config configs/my-app.json --execute-planner --execute-builder --execute-reviewer --allow-writes`
- Write-enabled continuation builder first, reviewer/checks later:
  - `npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder --allow-writes`
  - `npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer --run-checks`
- Write-enabled fix continuation:
  - `npm run agent -- continue-run <run-id> --config configs/my-app.json --plan-fix --execute-fix --allow-writes`
