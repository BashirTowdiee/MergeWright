# Stage 6 TUI command controller

Timestamp: 2026-05-23T12:14:00Z

Selected action: add TUI command controller foundation.

Active stage: Stage 6 TUI safe-write wiring.

Acceptance advanced:
- TUI command controller can preview intents through AppCommandService
- TUI command controller can submit commands through AppCommandService
- keeps TUI command execution service-first without filesystem, git, shell, or stdout parsing logic

Files touched:
- src/tui/command-controller.ts
- test/tui-command-controller.test.ts
- plans/events/2026-05-23T12-14-00-stage6-tui-command-controller.md

Branch: work/s6-tui-command-controller

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
