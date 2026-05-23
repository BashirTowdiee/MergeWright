# Stage 6 coordination-note UI wiring

Timestamp: 2026-05-23T13:52:00Z

Selected action: wire coordination-note command flow into the command palette UI surface.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- command palette exposes an enabled update-coordination-note command
- command palette Enter path can preview update-coordination-note through TuiCommandController
- second Enter submits the previewed update-coordination-note command through TuiCommandController
- AppCommandResult notice is rendered after submit
- keeps execution service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/command-palette.ts
- src/tui/SelectableApp.tsx
- test/tui-command-palette.test.ts
- plans/events/2026-05-23T13-52-00-stage6-coordination-note-ui.md

Branch: work/s6-coordination-note-ui

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
