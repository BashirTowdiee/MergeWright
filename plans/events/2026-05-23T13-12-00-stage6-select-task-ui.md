# Stage 6 select-task UI wiring

Timestamp: 2026-05-23T13:12:00Z

Selected action: wire select-task preview and submit flow into SelectableApp actions pane.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- TUI actions pane can preview a selected action as a select-task command through TuiCommandController
- second Enter submits the previewed select-task command through TuiCommandController
- AppCommandResult notice is rendered after submit
- keeps execution service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/select-task-preview-match.ts
- src/tui/SelectableApp.tsx
- test/tui-select-task-preview-match.test.ts
- plans/events/2026-05-23T13-12-00-stage6-select-task-ui.md

Branch: work/s6-select-task-ui

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
