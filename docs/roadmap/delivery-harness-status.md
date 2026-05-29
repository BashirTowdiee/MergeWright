# Delivery Harness Status

Last updated: 2026-05-30.

## DH-7 acceptance criteria mapping status

Status: implemented with reviewer-to-contract acceptance reconciliation.

Merged coverage:

- Reviewer verdict parser now accepts optional `acceptanceCriteria` entries with strict validation (`criterion`, `pass|fail|unknown`, optional `evidence`).
- Reviewer prompt now includes a dedicated structured acceptance-criteria section and requires criterion mapping in the verdict JSON.
- Reporting now reconciles stage-contract acceptance criteria against reviewer mappings and produces deterministic pass/fail/unknown summaries.
- Unknown acceptance criteria now block readiness by default (`BLOCKED`).
- Failed acceptance criteria now force fix-required readiness (`NEEDS_FIX`).
- Evidence refresh/backfill paths now preserve reviewer acceptance mappings in `evidence.acceptance` when present.
- Tests cover parser validation, reconciliation mapping, report blocking behavior, and evidence persistence.

Important constraint:

- Reviewer verdict v2 fields beyond acceptance mapping (`evidenceChecked`, `testsObserved`, `riskLevel`, `recommendedFixPrompt`) are not yet enforced. That remains DH-8.

Next recommended slice:

- Implement DH-8 by extending reviewer verdict shape while preserving strict parser behavior and backward compatibility.
