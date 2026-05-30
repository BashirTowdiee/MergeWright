# Delivery Harness Status

Last updated: 2026-05-30.

## DH-10 TUI evidence/prove integration status

Status: implemented with TUI readiness/evidence snapshot integration and fallback behavior.

Merged coverage:

- TUI run inspection now loads readiness snapshots from `run-report.json` when available.
- TUI falls back to `evidence.json` readiness/checks/reviewer/git data when report output is missing.
- TUI now shows readiness status, score/risk, checks state, reviewer verdict, changed file count, and missing-evidence warning count in run context.
- Missing evidence warnings are surfaced in run warnings with deterministic `evidence:` prefixes.
- If neither report nor evidence manifest exists, TUI remains read-only and uses an explicit fallback readiness snapshot (`unknown`) with guidance warnings.

Important constraint:

- Run comparison and cross-run readiness diffing are not yet implemented. That remains DH-11.

Next recommended slice:

- Implement DH-11 compare-runs so operators can diff readiness/evidence outcomes between two runs.
