# Stage 8 reviewer routing slice

Timestamp: 2026-05-24T10:25:00Z

Selected action: implement service-routed reviewer retry-phase support.

Active stage: Stage 8 planner and reviewer orchestration.

Acceptance criteria advanced:
- retry-phase reviewer commands route through the application command service
- command results remain structured with runId and artefact paths
- no CLI command string is constructed by TUI code
- no TUI stdout parsing is introduced

Files touched:
- src/application/commands/default-app-command-service.ts
- test/app-command-service.test.ts
- plans/events/2026-05-24T10-25-00Z-chatgpt-s8-reviewer-routing.md

PR/branch:
- work/stage-8-reviewer-routing

Commit/head SHA:
- 2e678c4708010549e9d5362ead0b9a7d08d60470 before this event

Tests/checks run:
- Not run locally from connector environment.
- CI should validate after PR creation.

CI status:
- not started

Merge status:
- not merged

Blockers:
- none at event creation time

Next recommended action:
- open PR and wait for CI.