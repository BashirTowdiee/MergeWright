# Delivery Harness Status

Last updated: 2026-05-21.

## DH-2 Evidence backfill status

Status: implemented as an additive foundation.

Merged coverage:

- `src/evidence/evidence-backfill.ts` reconstructs `evidence.json` from existing run artefacts.
- Backfill reads `run.json`, write-audit summaries, `checks-status.json`, and reviewer output.
- Backfill represents missing and malformed artefacts explicitly in diagnostics and risk reasons.
- `backfill-evidence <run-id> --config <config-path> [--dry-run]` exposes the helper through CLI.
- Command tests cover validation, dry-run preview, and write mode.
- Evidence backfill tests cover complete artefacts, malformed artefacts, missing run metadata, failed checks, and status backfill from run metadata.

Important constraint:

- `report-run` is not yet migrated to evidence-first behaviour. That remains DH-3.

Next recommended slice:

- Start DH-3 by adding a narrow evidence-backed report test that proves `report-run` or `generateChangeReport` prefers `evidence.json` while preserving legacy runs.
