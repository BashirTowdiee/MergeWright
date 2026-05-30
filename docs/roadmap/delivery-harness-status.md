# Delivery Harness Status

Last updated: 2026-05-30.

## DH-12 parallel focused reviews status

Status: implemented with read-only focused assurance mode reviews and aggregate gating.

Merged coverage:

- Added `review-modes <run-id> --config ... [--modes ...] [--json]` as a read-only CLI command.
- Modes supported: `architecture`, `tests`, `regression`, `security`, `docs`, `maintainability`.
- Each selected mode emits a reviewer-verdict-v2 shaped decision with focused checklist evidence.
- Aggregate verdict fails when any selected mode verdict fails; command exits non-zero for aggregate `FAIL`.
- `--json` emits a machine-readable focused review payload and suppresses progress logs for clean JSON stdout.
- Command does not execute Codex, does not run checks, does not mutate git/workspace state, and does not write report artefacts.
- Added parser/validation/progress-log/command behavior tests plus pure focused-review mapper tests.

Important constraint:

- Runner contract hardening is not yet implemented. That remains DH-13.

Next recommended slice:

- Implement DH-13 runner contract hardening (capabilities, metadata namespacing, and backend boundary tightening).
