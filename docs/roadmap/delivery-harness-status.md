# Delivery Harness Status

Last updated: 2026-05-30.

## DH-9 evidence-first reviewer prompt hardening status

Status: implemented with enforced evidence-first prompt ordering and ordering-proof tests.

Merged coverage:

- Reviewer prompt section order now follows the required evidence-first sequence:
  1. git diff/status
  2. test/check evidence
  3. changed-files evidence
  4. stage contract and acceptance criteria
  5. implementation notes
  6. planner/builder summaries
- Prompt language now explicitly enforces review order in the required checks block.
- Automated prompt tests now assert a deterministic heading sequence to prevent ordering drift.
- Reviewer prompt coverage tests keep evidence-first sections before all context summaries.

Important constraint:

- TUI evidence/prove integration is not yet implemented. That remains DH-10.

Next recommended slice:

- Implement DH-10 by integrating evidence/prove readiness views into the TUI read model.
