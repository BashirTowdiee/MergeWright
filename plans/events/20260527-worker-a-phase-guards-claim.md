# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T00:40:00+10:00

selected action: Extract continue-run phase guard helpers into a focused helper module with tests.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: orchestration helper logic continues moving out of the large root continuation module while preserving documented CLI behaviour.

intended branch: agent/chatgpt-worker-a/continue-run-phase-guards

PR number: none

files/directories likely to be touched:
- src/continue-run/phase-guards.ts
- test/continue-run-phase-guards.test.ts
- plans/events/*

collision check:
- Open PR scan returned no open PRs.
- Prior worker-a wiring claim touched src/continue-run.ts only and is not being edited in this slice because full-file replacement is unsafe through this connector.
- This slice adds non-overlapping helper and test files only.
