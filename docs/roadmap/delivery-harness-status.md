# Delivery Harness Status

Last updated: 2026-05-30.

## DH-11 run comparison status

Status: implemented with read-only run-to-run readiness/evidence comparison.

Merged coverage:

- Added `compare-runs <run-id-a> <run-id-b> --config ... [--json]` as a read-only CLI command.
- Comparison computes readiness status deltas, score/risk deltas, reviewer/checks deltas, changed-file diffs, failed-check diffs, and acceptance regressions/improvements.
- `--json` emits a machine-readable comparison payload and suppresses progress logs for clean JSON stdout.
- Missing evidence remains explicit per run via evidence availability and risk-signal extraction.
- Command does not execute Codex, does not run checks, does not mutate git/workspace state, and does not write report artefacts.
- Added focused parser/validation/command behavior tests plus pure comparison-mapper tests.

Important constraint:

- Parallel focused reviews are not yet implemented. That remains DH-12.

Next recommended slice:

- Implement DH-12 parallel focused reviews (architecture/tests/regression/security/docs/maintainability modes).
