# Stage 8 runner adapter write blocker

Timestamp: 2026-05-24T11:20:00Z

Selected action: complete the Stage 8 runner-backed command adapter slice.

Active stage: Stage 8 planner and reviewer orchestration.

Acceptance criteria targeted:
- existing runner/orchestration logic is reused
- command results include run IDs and artefact paths
- no CLI command string is constructed by TUI code
- no TUI stdout parsing is introduced

Files intended in scope:
- src/application/commands/runner-command-adapter.ts
- test/runner-command-adapter.test.ts or equivalent focused adapter tests

PR/branch:
- work/stage-8-runner-command-adapter

Commit/head SHA:
- branch file still at eb177ec2b08ef22b763bdfd0706d8d3c85949d59 for runner-command-adapter.ts

Current branch state:
- runner-command-adapter.ts exists
- reviewer retry-phase currently routes through runStage instead of continueRun
- current-cycle update attempt for runner-command-adapter.ts did not persist through the connector

Tests/checks run:
- none

CI status:
- not started

Merge status:
- not merged

Blockers:
- source update for the selected adapter implementation did not persist through the connector in this cycle

Next recommended action:
- use a local checkout or permitted write path to update the adapter so planner start-run uses runStage and reviewer retry-phase uses continueRun, then add focused tests for option mapping and structured command results.