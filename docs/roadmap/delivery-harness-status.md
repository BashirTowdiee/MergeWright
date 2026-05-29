# Delivery Harness Status

Last updated: 2026-05-29.

## DH-3 report integration status

Status: implemented with evidence-first preference and legacy fallback.

Merged coverage:

- `generateChangeReport` and `report-run` prefer `evidence.json` when available.
- Legacy runs without `evidence.json` still use existing artefact collectors.
- Evidence-backed fields are adapted for files, reviewer verdict, checks, write-safety, post-write-review, and risk.
- Report output shape and existing `report-run` flags remain compatible.
- Tests cover evidence-backed and legacy behaviour, including missing evidence signalling.

Important constraint:

- Merge-readiness still has no dedicated read-only proof command. That remains DH-4.

Next recommended slice:

- Implement DH-4 by adding `prove <run-id> --config <config-path> [--json]` as a read-only readiness command with non-zero exit for non-ready states.
