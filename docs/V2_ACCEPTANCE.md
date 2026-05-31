# V2 Acceptance (Write Mode Hardening)

## Capability Summary
- Write mode is explicit: `--allow-writes`.
- `writeSafety.enabled` must be `true`.
- Only builder/fix may run with `workspace-write`.
- Planner/reviewer/review-to-fix remain read-only.
- Write-enabled phases capture write-audit artefacts.
- Post-write review is enforced before checks.
- Commit/push remain manual user actions.

## Safety Checklist
- No new execution phases.
- No auto-commit, auto-push, or git mutation orchestration.
- Stage H command safety denylist remains enforced.
- Dry-run never executes Codex/checks and does not persist continuation metadata mutations.
- Checks are blocked while `postWriteReview.status` is `pending` or `failed`.

## Recommended Workflow
1. `npm run agent -- check-write-safety --config .artifacts/projects/my-app/config.json`
2. `npm run agent -- run <stage-name> --config .artifacts/projects/my-app/config.json --execute-planner --execute-builder --execute-reviewer --allow-writes`
3. Inspect `.artifacts/runs/<project>/<run-id>/write-audit/builder/summary.json` (or `fix/summary.json`)
4. If needed, continue fix flow:
5. `npm run agent -- continue-run <run-id> --config .artifacts/projects/my-app/config.json --plan-fix --execute-fix --allow-writes`
6. Complete reviewer gate (if pending):
7. `npm run agent -- continue-run <run-id> --config .artifacts/projects/my-app/config.json --execute-reviewer`
8. Run checks:
9. `npm run agent -- continue-run <run-id> --config .artifacts/projects/my-app/config.json --run-checks`
10. Manually inspect and commit in target repo.

## Write-Audit Inspection
- Builder artefacts: `write-audit/builder/*`
- Fix artefacts: `write-audit/fix/*`
- Primary summary: `write-audit/<phase>/summary.json`
- Summary paths are run-relative and include diff/stat/status/changed-files references.

## Post-Write Review
- Write-enabled builder/fix sets `postWriteReview.required=true`.
- `run` requires reviewer in the same command for write mode.
- `continue-run` can leave review pending after write-enabled builder/fix; later reviewer continuation completes it.
- `postWriteReview.requiredByPhases` accumulates `builder` and/or `fixExecution`.

## Checks Enforcement
- Checks can run only after post-write review is complete for write-enabled flows.
- Combined continuation (`--execute-reviewer --run-checks`) runs checks after reviewer success.
- Dangerous configured checks remain denied (`bash -lc`, git mutation subcommands, `env` trampoline, dangerous `rm` flags).

## Manual Commit
- No auto-commit path exists.
- No auto-push path exists.
- User inspects run artefacts and executes git commit/push manually in target repo.

## Recovery And Troubleshooting
- Write-safety failure: inspect `write-safety-result.json`; fix branch/cleanliness/blocked path issues.
- Checks blocked: inspect `run.json` `postWriteReview.status`, then run reviewer continuation.
- Dry-run expectation mismatch: verify `--dry-run`; execution artefacts and continuation metadata should not mutate.
- Malformed run metadata: use `show-run` fallback output and rerun missing phases via `continue-run`.

## Known Limitations
- No auto-fix loops beyond configured explicit phases.
- No branch creation or commit helper commands.
- No write-enabled presets; writes require explicit `--allow-writes`.
