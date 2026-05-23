# Stage 6 select-task flow

Timestamp: 2026-05-23T12:54:00Z

Selected action: add TUI select-task preview and submit flow.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- TUI can preview select-task through TuiCommandController
- TUI can submit the previewed select-task command through TuiCommandController
- TUI can render AppCommandResult notice through command result state
- keeps select-task execution service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/select-task-command-flow.ts
- test/tui-select-task-command-flow.test.ts
- plans/events/2026-05-23T12-54-00-stage6-select-task-flow.md

Branch: work/s6-task-flow

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
