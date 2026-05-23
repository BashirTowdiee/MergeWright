# MergeWright TUI Roadmap

Status: active

Scope: move the TUI from read-only inspection to a safe operator console through a service-first command layer.

## Architectural rule

Allowed path:

```text
TUI -> typed command -> application service -> domain/use case -> adapters
```

Forbidden paths:

```text
TUI -> shell command
TUI -> direct file edit
TUI -> parse CLI stdout
TUI -> mutate git/plans/runs directly
TUI -> bypass write-safety checks
```

The TUI must not become a second CLI implementation. CLI, TUI, MCP, and future web surfaces should share application services.

## Stage 1: Command boundary foundation

Goal: define stable, serialisable commands and structured command outputs.

Deliverables:
- typed application command model
- command source and actor metadata
- typed command result model
- command risk model
- command description model
- application command service shell

Acceptance criteria:
- commands describe product intent, not shell execution
- every command includes source/actor metadata
- command results are structured and renderable by the TUI
- failures use stable result codes rather than uncaught UI exceptions
- command descriptions expose risk, summary, and preconditions
- unimplemented commands fail deterministically with `EXECUTION_FAILED`

Dependencies:
- existing `src/application/commands/app-command.ts`
- existing `src/application/commands/command-source.ts`

Next action:
- complete the command result, risk, description, and service-shell slice before wiring any TUI execution.

## Stage 2: Boundary and drift tests

Goal: enforce that the TUI cannot bypass the service-first command layer.

Deliverables:
- architecture tests for forbidden TUI imports
- architecture tests for direct write and shell boundaries

Acceptance criteria:
- tests fail if `src/tui/**` imports `child_process`
- tests fail if `src/tui/**` imports write-capable filesystem APIs
- tests fail if TUI code introduces shell-shaped command execution

Dependencies:
- Stage 1 command boundary foundation

Next action:
- add architecture tests immediately after the service shell exists.

## Stage 3: Read-model extraction

Goal: move TUI selection and dashboard derivation out of `SelectableApp`.

Deliverables:
- dashboard read-model service
- selected run/phase/action/artefact/finding derivation helpers
- command preview input read model

Acceptance criteria:
- `SelectableApp` mostly coordinates state and rendering
- selection derivation is tested without React
- fixture-backed read models still support the current spike flow

Dependencies:
- current TUI pane extraction work
- existing selection context helpers

Next action:
- extract dashboard state after the command boundary is committed.

## Stage 4: Safe local commands

Goal: implement low-risk write commands before orchestration.

Deliverables:
- `select-task` handler
- `update-coordination-note` handler
- `mark-task-reviewed` handler
- `add-task-comment` handler

Acceptance criteria:
- commands run only through `AppCommandService`
- existing planning content is preserved
- validation covers missing IDs, empty note/comment values, and conflicts
- command results include changed file metadata when writes occur

Dependencies:
- Stage 1 command service shell
- Stage 2 boundary tests

Next action:
- implement `select-task` first because it is the smallest useful write intent.

## Stage 5: Audit logging

Goal: make every attempted write command traceable.

Deliverables:
- command audit record model
- command audit store interface
- filesystem audit store
- command service audit integration

Acceptance criteria:
- successful commands produce audit records
- failed commands produce audit records
- audit records include command ID, type, source, actor, risk, input summary, result, changed files, and artefacts
- existing audit records are not overwritten

Dependencies:
- Stage 4 safe command handlers

Next action:
- wire audit logging before any orchestration command is exposed.

## Stage 6: TUI safe-write wiring

Goal: let the TUI execute safe commands through the service layer.

Deliverables:
- TUI command controller
- command result pane state
- wiring for `select-task`
- wiring for coordination note updates

Acceptance criteria:
- TUI maps each UI action to exactly one `AppCommand`
- TUI renders `CommandDescription` before execution where required
- TUI renders `AppCommandResult` after execution
- TUI contains no filesystem, git, shell, or orchestration logic

Dependencies:
- Stage 4 safe command handlers
- Stage 5 audit logging

Next action:
- wire only `select-task` first.

## Stage 7: Confirmation gates

Goal: expose risk and confirmation requirements without duplicating business rules in the TUI.

Deliverables:
- confirmation model
- confirmation state machine
- confirmation overlay
- service-owned precondition rendering

Acceptance criteria:
- moderate and dangerous commands can be described before execution
- dangerous commands require explicit confirmation
- failed preconditions block execution
- confirmation state is auditable

Dependencies:
- Stage 1 command descriptions
- Stage 6 TUI command controller

Next action:
- add confirmation support before planner/reviewer orchestration.

## Stage 8: Planner and reviewer orchestration

Goal: expose read-only planner/reviewer flows through the command service.

Deliverables:
- `start-run` handler for planner/reviewer flows
- `run-planner` behaviour through service routing
- `run-reviewer` behaviour through service routing
- structured result rendering in the TUI

Acceptance criteria:
- existing runner/orchestration logic is reused
- command results include run IDs and artefact paths
- no CLI command string is constructed by TUI code
- no TUI stdout parsing is introduced

Dependencies:
- Stage 7 confirmation gates
- existing runner services

Next action:
- implement planner-only command support before reviewer support.

## Stage 9: Structured progress events

Goal: display live progress without scraping process output.

Deliverables:
- app event model
- app event bus
- command service event emission
- TUI progress pane

Acceptance criteria:
- TUI receives typed progress events
- command start/finish and phase start/finish are represented structurally
- phase output chunks are events, not parsed CLI stdout

Dependencies:
- Stage 8 orchestration commands

Next action:
- add event bus before long-running builder work is exposed.

## Stage 10: Builder execution gates

Goal: expose builder execution only behind strong safety controls.

Deliverables:
- `execute-builder` command
- builder precondition checks
- confirmation requirements
- service-routed builder execution

Acceptance criteria:
- builder cannot run with writes unless confirmation passes
- builder uses the same write-safety path as the CLI
- dirty repo, unsafe branch, dependency-blocked, and overlapping file-scope cases are blocked
- builder output is captured as artefacts

Dependencies:
- Stage 9 progress events
- existing write-safety checks

Next action:
- implement precondition descriptions before execution.

## Stage 11: PR and git operations

Goal: support merge-ready workflows from the TUI through service commands.

Deliverables:
- merge-ready check command
- commit command
- push command
- merge PR command

Acceptance criteria:
- dangerous operations require confirmation
- merge requires prior merge-ready check success
- operations follow repo policy
- audit records include changed files and remote operation metadata

Dependencies:
- Stage 10 builder execution gates

Next action:
- implement merge-ready check before commit/push/merge.

## Stage 12: Product hardening

Goal: make the TUI reliable for daily use.

Deliverables:
- real workspace bootstrap path
- fixture/demo mode retained for tests
- empty/loading/error states
- integration smoke test
- keyboard help generated from central shortcut definitions

Acceptance criteria:
- TUI boots with real workspace data
- TUI boots with fixture data
- missing workspace renders a structured error state
- keyboard help matches actual key handlers

Dependencies:
- prior TUI command and read-model stages

Next action:
- replace fixture-first boot path after safe command wiring is stable.
