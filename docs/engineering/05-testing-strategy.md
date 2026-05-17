# Testing Strategy

## Purpose

This document defines the testing strategy for Shepherds-Staff as it grows from a CLI tool into a multi-surface orchestration product.

## Testing goals

- Protect safety boundaries.
- Protect run lifecycle behaviour.
- Prevent partial or unsafe artefact writes.
- Keep CLI behaviour stable.
- Validate auto-chain decisions.
- Prepare for API and GUI testing.

## Test layers

### Unit tests

Use for pure logic and small modules.

Coverage areas:

- Config validation.
- Stage validation.
- Phase ordering.
- Safety rules.
- Auto-chain decision logic.
- Report policy logic.
- Provider request construction.

### Integration tests

Use for command and workflow behaviour.

Coverage areas:

- CLI command execution.
- Run directory creation.
- Artefact writing.
- Continue-run behaviour.
- Write-safety blocking.
- Report generation.
- Dry-run projection.

### Contract tests

Use for future API and provider boundaries.

Coverage areas:

- Provider adapter contract.
- Run metadata schema.
- Artefact manifest schema.
- Event stream schema.
- API response shapes.

### UI tests, future

Use once the local dashboard exists.

Coverage areas:

- Run list rendering.
- Run detail rendering.
- Phase timeline states.
- Artefact viewer.
- Review gate actions.
- Change report panel.

## Critical regression areas

- Planner and reviewer must remain read-only.
- Write-enabled builder/fix must require safety checks.
- Post-write review must block checks until completed.
- Auto-chain must respect max fix attempts.
- Failed primary commands must not hide report generation failures.
- Existing artefacts should not be overwritten unless explicitly forced.
- Continue-run must not skip required gates.

## Test data

Use temporary repositories and temporary run directories for integration tests.

Test fixtures should include:

- Valid project config.
- Invalid project config.
- Valid stage file.
- Invalid stage file.
- Existing run with partial phases.
- Existing run requiring review.
- Existing run with failed checks.

## Manual testing checklist

Before release:

- Run safe dry-run.
- Run plan-only flow.
- Run full read-only flow.
- Run write-enabled flow with safety passing.
- Run write-enabled flow with safety failing.
- Run auto-chain with zero fix attempts.
- Run auto-chain with bounded fix attempts.
- Generate change report.
- Generate PR summary.
- Continue a stopped run.
