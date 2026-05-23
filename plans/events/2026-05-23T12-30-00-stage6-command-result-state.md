# Stage 6 command result state

Timestamp: 2026-05-23T12:30:00Z

Selected action: add TUI command result state helper.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- command result pane state foundation can represent idle and completed command results
- successful command results can be formatted for TUI notices
- failed command results can be formatted for TUI notices
- keeps command result handling service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/command-result-state.ts
- test/tui-command-result-state.test.ts
- plans/events/2026-05-23T12-30-00-stage6-command-result-state.md

Branch: work/s6-command-result-state

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
