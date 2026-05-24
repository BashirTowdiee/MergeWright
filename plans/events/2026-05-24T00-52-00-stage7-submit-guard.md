# Stage 7 submit guard

Timestamp: 2026-05-24T00:52:00+10:00

Selected action: guard TUI command submission with service-owned confirmation and precondition checks.

Active stage: Stage 7 confirmation gates.

Acceptance advanced:
- command submission re-describes commands before execution
- failed preconditions block execution before AppCommandService.execute is called
- confirmation-required commands block execution without a matching confirmation token
- matching confirmation tokens allow execution to continue through AppCommandService
- no filesystem, git, shell, or stdout parsing logic added to the TUI

Files touched:
- src/tui/command-confirmation-state.ts
- src/tui/command-controller.ts
- test/tui-command-controller.test.ts
- plans/events/2026-05-24T00-52-00-stage7-submit-guard.md

Branch: work/s7-submit-guard

Tests: not run locally from connector environment. CI should validate after PR creation.

Next action: open PR and verify CI/mergeability.
