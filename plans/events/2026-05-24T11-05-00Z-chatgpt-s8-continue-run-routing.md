# Stage 8 continue-run routing slice

Timestamp: 2026-05-24T11:05:00Z

Selected action:
- Implement service-routed continue-run support.

Active stage:
- Stage 8 planner and reviewer orchestration.

Acceptance criteria advanced:
- continue-run commands route through the application command service.
- command results remain structured with runId and artefact paths from the injected handler.
- invalid run IDs fail deterministically before handler execution.
- unwired continue-run execution fails deterministically with EXECUTION_FAILED.
- no CLI command string is constructed by TUI code.
- no TUI stdout parsing is introduced.

Files touched:
- src/application/commands/default-app-command-service.ts
- test/app-command-service.test.ts
- plans/events/2026-05-24T11-05-00Z-chatgpt-s8-continue-run-routing.md

PR/branch:
- Branch: s8-continue-run-routing

Commit/head SHA:
- f2c4859f5dda18198bf2f454c752b78c900f09aa before this event

Tests/checks run:
- Not run locally from connector environment.
- CI should validate after PR creation.

CI status:
- not started

Merge status:
- not merged

Blockers:
- Local checkout and local test execution unavailable in this connector environment.

Next recommended action:
- Open PR and wait for CI.