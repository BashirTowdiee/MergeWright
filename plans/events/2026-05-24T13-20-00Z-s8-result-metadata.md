# Stage 8 result metadata rendering

Timestamp: 2026-05-24T13:20:00Z

Selected action: render structured command result metadata in TUI notices.

Active stage: Stage 8 planner and reviewer orchestration.

Acceptance criteria advanced:
- TUI command result notices render run IDs.
- TUI command result notices render artefact paths.
- Existing failure and changed-file notices remain structured.
- No CLI command strings or stdout parsing were added.

Files touched:
- src/tui/command-result-state.ts
- test/tui-command-result-state.test.ts

Branch: s8-result-metadata-rendering
Head SHA before this event: 3651d791c2bdeef08d8e2f7eae128b74b9a0b942

Tests/checks: not run locally from connector environment.
CI status: not started.
Merge status: not merged.
Blockers: local checkout unavailable.
Next action: open PR and wait for CI.
