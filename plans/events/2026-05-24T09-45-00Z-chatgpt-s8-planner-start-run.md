# Stage 8 planner start-run slice

Timestamp: 2026-05-24T09:45:00Z

Selected action: implement planner-only start-run support through the application command service.

Active stage: Stage 8 planner and reviewer orchestration.

Acceptance criteria advanced:
- command service can route start-run through an injected service handler
- command results include structured runId and artefact paths
- no CLI command string is constructed by TUI code
- no TUI stdout parsing is introduced

Files touched:
- src/application/commands/default-app-command-service.ts
- test/app-command-service.test.ts
- plans/events/2026-05-24T09-35-00Z-chatgpt-s8-planner-start-run-blocked.md
- plans/events/2026-05-24T09-45-00Z-chatgpt-s8-planner-start-run.md

PR/branch:
- work/s8-planner-start-run

Commit/head SHA:
- 241e7667189fc7f5cef441a01ef1c4ead2e68629 before this event

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