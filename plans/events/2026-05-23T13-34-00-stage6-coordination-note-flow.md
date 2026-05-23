# Stage 6 coordination-note flow

Timestamp: 2026-05-23T13:34:00Z

Selected action: add TUI coordination-note intent and command flow.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- TUI can map coordination note input to exactly one update-coordination-note AppCommand intent
- TUI can preview update-coordination-note through TuiCommandController
- TUI can submit the previewed update-coordination-note command through TuiCommandController
- TUI can render AppCommandResult notice through command result state
- keeps coordination-note execution service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/coordination-note-intent.ts
- src/tui/coordination-note-command-flow.ts
- test/tui-coordination-note-command-flow.test.ts
- plans/events/2026-05-23T13-34-00-stage6-coordination-note-flow.md

Branch: work/s6-coordination-note-flow

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
