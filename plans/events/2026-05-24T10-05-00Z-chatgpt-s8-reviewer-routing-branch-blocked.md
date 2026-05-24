# Stage 8 reviewer routing branch blocker

Timestamp: 2026-05-24T10:05:00Z

Selected action: implement the next Stage 8 reviewer routing slice.

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
- intended branch: work/s8-reviewer-retry-phase or work/s8-phase-routing

Commit/head SHA:
- intended base: 246caf6f1603739ca028ba327579a834e7b0c1c8

Tests/checks run:
- none

CI status:
- not started

Merge status:
- not merged

Blockers:
- branch creation was blocked twice by connector safety checks in this cycle

Next recommended action:
- use a local checkout or permitted branch creation path to create the Stage 8 reviewer routing branch, then add a service-routed retry-phase/reviewer handler with focused tests.