# TUI Write Capability Roadmap

Status: Proposed  
Scope: Move the TUI from read-only inspection to safe write-capable orchestration through a service-first command layer.

## Goal

The TUI may become write-capable, but only through typed application commands.

Correct architecture:

```text
TUI -> typed command -> application service -> domain/use case -> adapters
```

Forbidden architecture:

```text
TUI -> shell command
TUI -> direct file edit
TUI -> parse CLI stdout
TUI -> mutate git/plans/runs directly
```

The TUI must never become a second CLI implementation.

## Non-negotiable constraints

- TUI must not call `child_process`.
- TUI must not run `npm`, `git`, `codex`, or backend commands directly.
- TUI must not parse CLI stdout.
- TUI must not write coordination files directly.
- TUI must not directly mutate run artefacts.
- TUI must not bypass write-safety checks.
- CLI, TUI, MCP, and future web UI must share the same application services.

## Roadmap overview

| Stage | Theme | Primary goal | Outcome |
| --- | --- | --- | --- |
| 0 | Architectural rule | Document and test the service-first boundary | Shared implementation rule |
| 1 | Command model | Represent write intent as typed commands | No shell-shaped TUI actions |
| 2 | Command results | Return deterministic structured results | No stdout parsing |
| 3 | Command service | Add one write entry point for UI-facing actions | Central validation, safety, audit |
| 4 | Read/write split | Separate read models from write commands | Clean TUI surfaces |
| 5 | Low-risk writes | Start with safe local state/coordination commands | Useful writes without execution risk |
| 6 | Confirmation gates | Describe command risk before execution | Safe UI prompts |
| 7 | Orchestration commands | Add planner/reviewer command paths | Reuse existing runner logic |
| 8 | Builder gates | Expose builder only behind strong safety checks | Controlled write execution |
| 9 | Progress events | Stream typed progress events | Live TUI feedback without scraping |
| 10 | Audit log | Record attempted, failed, and successful commands | Traceable write history |
| 11 | TUI rollout | Wire actions gradually | Safe incremental UX |
| 12 | Drift tests | Block forbidden imports and paths | Long-term architecture safety |

---

# Stage 0: Lock the architectural rule

## High-level objective

Document the service-first command rule before implementing write-capable TUI behaviour.

## Mid-level implementation

Create or update:

```text
docs/architecture/tui.md
docs/architecture/service-first-commands.md
AGENTS.md
```

## Low-level tasks

- State that all TUI write actions must go through typed application commands.
- List forbidden patterns explicitly.
- Name the command-service boundary as the only allowed write path.
- Explain that CLI, TUI, MCP, and future web UI share the same service layer.
- Add early architecture tests that protect the TUI boundary.

## Acceptance criteria

- TUI write policy is documented.
- Forbidden patterns are explicitly listed.
- Command service is the only allowed write path.
- Architecture tests fail if TUI imports shell execution or write-capable file APIs.

---

# Stage 1: Define the command model

## High-level objective

Represent user intent as typed, serialisable application commands.

## Mid-level implementation

Create:

```text
src/application/commands/app-command.ts
src/application/commands/command-source.ts
```

## Low-level tasks

Define command types such as:

```ts
export type AppCommand =
  | SelectTaskCommand
  | UpdateCoordinationNoteCommand
  | StartRunCommand
  | ContinueRunCommand
  | RetryPhaseCommand
  | ApproveTaskCommand
  | MarkTaskBlockedCommand;
```

Use intent, not implementation details:

```ts
export type StartRunCommand = {
  type: "start-run";
  stageId: string;
  preset?: string;
  phases: Array<"planner" | "builder" | "reviewer">;
  allowWrites: boolean;
  actor: "cli" | "tui" | "mcp" | "automation";
};
```

Do not encode shell instructions:

```ts
// Bad
{
  shell: "npm run agent -- run foo --execute-builder"
}
```

## Acceptance criteria

- Commands are typed.
- Commands contain intent, not shell instructions.
- Commands include actor/source.
- Commands are serialisable for audit logging.
- No TUI-specific command shape leaks into domain logic.

---

# Stage 2: Add command result types

## High-level objective

Every command returns a deterministic result that the TUI can render without parsing stdout.

## Mid-level implementation

Create:

```text
src/application/commands/app-command-result.ts
```

## Low-level tasks

Define a result shape similar to:

```ts
export type AppCommandResult =
  | {
      ok: true;
      commandId: string;
      type: string;
      message: string;
      artefacts?: string[];
      runId?: string;
      changedFiles?: string[];
    }
  | {
      ok: false;
      commandId: string;
      type: string;
      reason: string;
      code:
        | "VALIDATION_FAILED"
        | "WRITE_SAFETY_FAILED"
        | "CONFIRMATION_REQUIRED"
        | "NOT_FOUND"
        | "CONFLICT"
        | "EXECUTION_FAILED";
      details?: unknown;
    };
```

## Acceptance criteria

- Results are typed.
- Failure is explicit and does not leak through the UI layer as raw exceptions.
- Result codes are stable enough for TUI rendering.
- Results do not require stdout parsing.

---

# Stage 3: Implement the command service boundary

## High-level objective

Add a single service interface for executing write-capable actions.

## Mid-level implementation

Create:

```text
src/application/commands/app-command-service.ts
src/application/commands/default-app-command-service.ts
```

## Low-level tasks

Define:

```ts
export interface AppCommandService {
  describe(command: AppCommand): Promise<CommandDescription>;
  execute(command: AppCommand): Promise<AppCommandResult>;
}
```

Responsibilities:

- validate command input
- describe risk and preconditions
- route to the correct use case
- enforce write safety
- create audit records
- return structured results

## Acceptance criteria

- TUI can execute commands through one service interface.
- `describe(command)` exposes risk, preconditions, and confirmation requirements.
- Validation runs before execution.
- Write-safety runs before write-capable commands.
- Audit records are produced for attempted, failed, and successful commands.
- No command path depends on CLI stdout parsing.

---

# Stage 4: Split read model from write commands

## High-level objective

Keep query/read behaviour separate from mutation/write behaviour.

## Mid-level implementation

Create or formalise:

```text
src/application/read-models/
src/application/commands/
```

## Low-level tasks

Read side examples:

```ts
getRuns()
getRunDetails(runId)
getTasks()
getTaskDetails(taskId)
getCoordinationState()
getPullRequestState()
getCiState()
```

Write side examples:

```ts
execute({ type: "select-task", ... })
execute({ type: "start-run", ... })
execute({ type: "update-coordination-note", ... })
```

## Acceptance criteria

- TUI does not read raw files directly when a read model exists.
- TUI does not write raw files directly.
- Read-model services are tested independently.
- Command services are tested independently.

---

# Stage 5: Introduce low-risk write commands first

## High-level objective

Give the TUI limited write capability before exposing orchestration or builder execution.

## Mid-level implementation

Start with:

```text
select-task
update-coordination-note
mark-task-reviewed
add-task-comment
```

## Low-level tasks

Example command:

```ts
export type UpdateCoordinationNoteCommand = {
  type: "update-coordination-note";
  workerId: string;
  note: string;
  actor: "tui";
};
```

Implement handlers under:

```text
src/application/commands/handlers/
```

## Acceptance criteria

- TUI can update coordination notes only through command service.
- Existing coordination files are never overwritten blindly.
- Writes are atomic where practical.
- Audit log records before/after metadata.
- Tests cover validation, success, and conflict cases.

---

# Stage 6: Add confirmation gates

## High-level objective

Expose command risk from the service layer so the TUI can render confirmations without duplicating business logic.

## Mid-level implementation

Create:

```text
src/application/commands/command-risk.ts
src/application/commands/command-description.ts
src/application/commands/confirmation.ts
```

## Low-level tasks

Risk levels:

```ts
export type CommandRisk = "safe" | "moderate" | "dangerous";
```

Command description:

```ts
export type CommandDescription = {
  type: AppCommand["type"];
  title: string;
  summary: string;
  risk: CommandRisk;
  requiresConfirmation: boolean;
  preconditions: Array<{
    id: string;
    label: string;
    status: "pass" | "fail" | "unknown";
    reason?: string;
  }>;
};
```

## Acceptance criteria

- Risk level is owned by the service layer.
- Dangerous commands require confirmation.
- TUI renders confirmation prompt from structured result or command description.
- Confirmation is included in the audit record.

---

# Stage 7: Add orchestration commands

## High-level objective

Expose planner/reviewer orchestration through the command service after low-risk writes are stable.

## Mid-level implementation

Commands:

```text
start-run
continue-run
retry-phase
run-reviewer
run-planner
```

## Low-level tasks

Start with read-only planner/reviewer flows:

```ts
export type StartRunCommand = {
  type: "start-run";
  stageId: string;
  preset?: string;
  phases: Array<"planner" | "reviewer">;
  allowWrites: false;
  actor: "tui";
};
```

## Acceptance criteria

- TUI can start planner/reviewer flows through command service.
- Existing stage-runner logic is reused.
- Existing write-safety checks are reused.
- Command result includes run ID and artefact paths.
- No CLI shell command is constructed by the TUI.

---

# Stage 8: Add builder execution behind stronger gates

## High-level objective

Expose builder execution only after confirmation, ownership, dependency, and write-safety checks are in place.

## Mid-level implementation

Command:

```ts
export type ExecuteBuilderCommand = {
  type: "execute-builder";
  stageId: string;
  runId?: string;
  allowWrites: boolean;
  actor: "tui";
  confirmation: {
    confirmed: boolean;
    text: string;
  };
};
```

## Low-level tasks

Required checks:

- git working tree safety
- branch safety
- configured workspace check
- task ownership check
- file scope overlap check
- plan dependency check
- optional max changed files threshold

## Acceptance criteria

- Builder cannot run with writes unless confirmation passes.
- Builder uses same write-safety path as CLI.
- Builder does not run if repo is dirty unless policy allows it.
- Builder output is captured as artefacts.
- TUI receives structured progress/events, not parsed stdout.

---

# Stage 9: Add structured progress events

## High-level objective

Give the TUI live progress without scraping process output.

## Mid-level implementation

Create:

```text
src/application/events/app-event.ts
src/application/events/app-event-bus.ts
src/application/events/in-memory-app-event-bus.ts
```

## Low-level tasks

Define events such as:

```ts
export type AppEvent =
  | { type: "command-started"; commandId: string; commandType: string }
  | { type: "phase-started"; commandId: string; phase: string }
  | { type: "phase-output"; commandId: string; phase: string; chunk: string }
  | { type: "phase-finished"; commandId: string; phase: string; status: "pass" | "fail" }
  | { type: "command-finished"; commandId: string; result: AppCommandResult };
```

## Acceptance criteria

- TUI receives progress through typed events.
- Events are emitted by the service/orchestrator layer.
- TUI never parses CLI stdout.
- Events are recorded or replayable where practical.

---

# Stage 10: Add audit log

## High-level objective

Make every write-capable command traceable.

## Mid-level implementation

Use one stable command audit location:

```text
runs/<run-id>/commands/<command-id>.json
```

For commands that happen before a run exists:

```text
runs/_global/commands/<command-id>.json
```

## Low-level tasks

Record:

```json
{
  "commandId": "cmd_123",
  "type": "start-run",
  "actor": "tui",
  "createdAt": "2026-05-21T00:00:00Z",
  "risk": "moderate",
  "input": {},
  "result": {},
  "changedFiles": [],
  "artefacts": []
}
```

## Acceptance criteria

- Every attempted write command is auditable.
- Failed commands are recorded.
- Confirmation state is recorded.
- Changed files and artefacts are recorded when available.
- Audit format is stable and documented.

---

# Stage 11: Add TUI actions gradually

## High-level objective

Wire the TUI to commands after the command service is stable.

## Mid-level implementation

Rollout order:

1. select task
2. update worker note
3. mark task as reviewed
4. create task comment
5. run planner
6. run reviewer
7. retry reviewer
8. continue run
9. execute builder with writes
10. apply fixer
11. commit changes
12. push branch
13. merge-ready check
14. merge PR
15. delete branches
16. destructive cleanup

## Low-level tasks

- Map every TUI action to exactly one command type.
- Render `CommandDescription` before risky actions.
- Render `AppCommandResult` after execution.
- Keep all filesystem, git, and orchestration details out of TUI components.

## Acceptance criteria

- Every TUI action maps to one command type.
- Dangerous actions show confirmation.
- TUI shows structured command result.
- TUI does not contain filesystem, git, or orchestration logic.

---

# Stage 12: Add tests that prevent architecture drift

## High-level objective

Prevent future changes from bypassing the service-first boundary.

## Mid-level implementation

Create:

```text
test/architecture/tui-boundary.test.ts
test/architecture/service-first-command-boundary.test.ts
```

## Low-level tasks

Test names:

```text
tui-does-not-import-child-process
tui-does-not-write-files-directly
tui-write-actions-go-through-command-service
command-service-enforces-write-safety
dangerous-command-requires-confirmation
```

## Acceptance criteria

- Tests fail if TUI imports shell execution.
- Tests fail if TUI imports write-capable filesystem utilities directly.
- Tests fail if TUI bypasses command service.
- Tests cover safe, moderate, and dangerous commands.

---

# Suggested implementation slices

## Slice 1: Documentation and boundaries

Files:

```text
docs/architecture/service-first-commands.md
docs/architecture/tui.md
AGENTS.md
test/architecture/tui-boundary.test.ts
```

Deliverable:

```text
Architecture rule documented and enforced by the first boundary tests.
```

## Slice 2: Command model

Files:

```text
src/application/commands/app-command.ts
src/application/commands/app-command-result.ts
src/application/commands/command-risk.ts
src/application/commands/command-description.ts
```

Deliverable:

```text
Typed command, result, risk, and description model.
```

## Slice 3: Command service shell

Files:

```text
src/application/commands/app-command-service.ts
src/application/commands/default-app-command-service.ts
test/app-command-service.test.ts
```

Deliverable:

```text
Command service validates and dispatches no-op or safe commands.
```

## Slice 4: Low-risk command implementation

Files:

```text
src/application/commands/handlers/select-task-command-handler.ts
src/application/commands/handlers/update-coordination-note-command-handler.ts
test/select-task-command-handler.test.ts
test/update-coordination-note-command-handler.test.ts
```

Deliverable:

```text
First real write commands without Codex or git execution.
```

## Slice 5: Read-model boundary

Files:

```text
src/application/read-models/
test/read-models/
```

Deliverable:

```text
TUI read paths use read-model services instead of direct raw-file access where a read model exists.
```

## Slice 6: TUI wiring for safe writes

Files depend on the current TUI structure:

```text
src/tui/actions/
src/tui/screens/
src/tui/state/
```

Deliverable:

```text
TUI can execute safe write commands through command service.
```

## Slice 7: Orchestration command support

Files:

```text
src/application/commands/handlers/start-run-command-handler.ts
src/application/commands/handlers/continue-run-command-handler.ts
src/application/commands/handlers/retry-phase-command-handler.ts
test/start-run-command-handler.test.ts
```

Deliverable:

```text
TUI can start planner/reviewer flows safely.
```

## Slice 8: Structured progress events

Files:

```text
src/application/events/app-event.ts
src/application/events/app-event-bus.ts
src/application/events/in-memory-app-event-bus.ts
```

Deliverable:

```text
TUI gets live structured progress without parsing CLI stdout.
```

## Slice 9: Dangerous command gates

Files:

```text
src/application/commands/confirmation.ts
src/application/commands/write-safety-command-policy.ts
test/dangerous-command-confirmation.test.ts
```

Deliverable:

```text
Builder/write-capable commands require confirmation and write-safety.
```

## Slice 10: Builder execution from TUI

Files:

```text
src/application/commands/handlers/execute-builder-command-handler.ts
test/execute-builder-command-handler.test.ts
```

Deliverable:

```text
TUI can execute builder only through guarded service command.
```

# Best first builder prompt

```text
Implement the service-first command boundary for future TUI write actions.

Scope:
- Add AppCommand, AppCommandResult, CommandRisk, and CommandDescription.
- Add AppCommandService with describe(command) and execute(command).
- Add DefaultAppCommandService skeleton with validation, command ID creation, risk lookup, precondition description, and handler dispatch.
- Implement only one low-risk command: update-coordination-note.
- Add architecture tests proving TUI-facing code does not call child_process, does not parse CLI stdout, and does not write files directly.
- Add docs explaining that CLI, TUI, MCP, and future web UI must share the application command service.

Constraints:
- Do not wire builder execution.
- Do not wire dangerous commands.
- Do not call shell commands from TUI-facing code.
- Do not parse CLI stdout.
- Do not duplicate stage-runner logic.
- Preserve service-first architecture.

Acceptance criteria:
- AppCommand and AppCommandResult are serialisable and typed.
- AppCommandService exposes describe(command) and execute(command).
- update-coordination-note is implemented through a command handler.
- Validation failure returns structured AppCommandResult failure.
- Confirmation/risk metadata is exposed through describe(command).
- TUI-facing code cannot import child_process or write-capable filesystem APIs.
- Documentation names the command service as the only allowed write path.
- npm run build and npm test pass.
```

# Matching review prompt

```text
You are the reviewer. Validate the service-first command boundary.

Focus on:
- TUI/write architecture safety
- typed command/result design
- validation and failure behaviour
- avoiding CLI stdout parsing
- avoiding direct shell/file mutation from UI-facing layers
- test coverage
- docs clarity

Acceptance criteria:
- AppCommand and AppCommandResult are serialisable and typed.
- AppCommandService exposes describe(command) and execute(command).
- update-coordination-note is implemented through a command handler.
- Failed validation returns structured failure instead of leaking implementation errors.
- Documentation explains how CLI, TUI, MCP, and future UI layers should share this command service.
- No TUI or UI-facing code calls child_process, git, npm, or codex directly.
- No TUI or UI-facing code parses CLI stdout.
- npm run build and npm test pass.

Output:
- Verdict: PASS or FAIL
- Findings by severity
- Acceptance criteria pass/fail table
- Concrete blocker reasons
- Minimal fix guidance
```
