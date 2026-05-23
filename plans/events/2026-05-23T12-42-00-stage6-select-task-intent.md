# Stage 6 select-task intent

Timestamp: 2026-05-23T12:42:00Z

Selected action: add TUI select-task intent builder.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- TUI can map a selected task to exactly one select-task AppCommand intent
- command metadata is TUI-sourced and deterministic
- keeps select-task wiring service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/select-task-intent.ts
- test/tui-select-task-intent.test.ts
- plans/events/2026-05-23T12-42-00-stage6-select-task-intent.md

Branch: work/s6-select-task-intent

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
