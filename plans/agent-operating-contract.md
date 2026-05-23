# Agent Operating Contract

Status: active

This contract governs agent work in this repository.

## Core operating rules

- Keep work in small, reviewable slices.
- Prefer one meaningful implementation slice per cycle.
- Update planning files before implementation when a roadmap or contract changes.
- Never overwrite existing planning history.
- Append to coordination files rather than replacing prior entries.
- If a planning-file update is blocked, write a fallback event under `plans/events/`.
- Do not start broad implementation without a recorded next action.

## TUI architecture rules

The TUI must use this path for write-capable behaviour:

```text
TUI -> typed command -> application service -> domain/use case -> adapters
```

Forbidden TUI behaviours:

- importing `child_process`
- invoking `npm`, `git`, `codex`, or backend commands directly
- writing files directly
- mutating planning files directly
- mutating run artefacts directly
- parsing CLI stdout as an integration boundary
- bypassing write-safety checks

## Command service rules

- All UI-facing mutations must enter through `AppCommandService`.
- Commands must represent product intent, not shell execution details.
- Command results must be structured and deterministic.
- Risk and confirmation requirements must be owned by the service layer.
- CLI, TUI, MCP, and future web UI should share command services.

## Planning rules

Before implementation starts:

- record the stage in `plans/roadmap.md`
- record coordination state in `plans/coordination.md`
- record dependencies and next action

Every implementation slice should record:

- timestamp
- selected item
- touched files
- PR number, when available
- CI status, when available
- blockers
- next action

## Review rules

Review should focus on:

- regressions
- missing tests
- unsafe assumptions
- dependency mistakes
- architecture boundary violations
- acceptance criteria alignment

A reviewer should fail a slice when:

- TUI bypasses command service
- write-safety is skipped
- shell/stdout parsing is introduced as a UI integration boundary
- tests do not cover the introduced behaviour
- planning files overwrite prior history

## Merge rules

A PR is merge-ready only when:

- required CI is green
- review blockers are resolved
- branch is mergeable
- roadmap/coordination updates are present when the work changes plan state
- implementation matches the selected slice

## Current next action

Complete the TUI command boundary foundation:

- command result type
- command risk type
- command description type
- command service interface
- default command service shell
- validation for unsupported/unimplemented execution
- architecture boundary tests for forbidden TUI imports
