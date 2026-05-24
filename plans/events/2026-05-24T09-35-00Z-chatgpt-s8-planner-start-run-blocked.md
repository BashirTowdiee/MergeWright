# Stage 8 planner start-run write blocker

Timestamp: 2026-05-24T09:35:00Z

Selected action: implement Stage 8 planner-only start-run support through the application command service.

Active stage: Stage 8 planner and reviewer orchestration.

Acceptance criteria targeted:
- existing runner/orchestration logic is reused
- command results include run IDs and artefact paths
- no CLI command string is constructed by TUI code
- no TUI stdout parsing is introduced

Files intended in scope:
- src/application/commands/default-app-command-service.ts
- test/app-command-service.test.ts

PR/branch:
- work/s8-planner-start-run

Commit/head SHA:
- branch based on 26d9f2a82eaa9a94f9ae1313718f1e6b8f3a705e

Tests/checks run:
- none

CI status:
- not started

Merge status:
- not merged

Blockers:
- source update to default-app-command-service.ts was blocked by connector safety checks in this cycle

Next recommended action:
- use a local checkout or permitted write path to add an injectable planner start-run handler to DefaultAppCommandService, returning structured runId and artefact paths without constructing CLI strings in TUI code.