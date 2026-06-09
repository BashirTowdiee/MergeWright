# Codex Prompt: Audited Workflow Runner Slice

Use this prompt with Codex to implement the next MergeWright product slice.

## Context

You are working in the `BashirTowdiee/MergeWright` repository.

MergeWright is being repositioned as an audited workflow runner for AI-assisted software changes.

Read these files first:

- `README.md`
- `docs/product/05-audited-workflow-runner-direction.md`
- `docs/product/04-roadmap.md`
- `docs/roadmap/delivery-harness.md`
- `docs/architecture/overview.md`
- `docs/workflows/classic-run.md`
- `docs/workflows/stage-plan.md`
- `docs/configuration/execution-backends.md`
- relevant package boundary files and tests under `packages/**`, `apps/**`, and `src/**`

Do not rely on prior chat context. Treat the repository as the source of truth.

## Product direction to implement

The new product primitive is a Run Contract.

A Run Contract defines:

- goal
- workspace
- flow
- stages
- stage executors
- model or harness selection per stage
- allowed and forbidden paths
- required checks
- required evidence
- approval gates
- stop conditions
- output artefacts
- audit expectations

The new execution abstraction is a Stage Executor.

A Stage Executor performs one stage and returns structured results. MergeWright still owns orchestration, policy, evidence, review gates, readiness decisions, and audit output.

Target long-term flow:

```text
plan -> build -> check -> review -> fix -> final-review
```

Example executor mapping:

```text
plan         -> codex:gpt-5.5-medium
build        -> codex:gpt-5.5-xhigh
check        -> shell
review       -> claude:configured-review-model
fix          -> codex:gpt-5.5-xhigh
final-review -> gemini:configured-review-model
```

Do not implement every backend. This slice should create the contracts and a thin vertical path that can later support multiple executors.

## Goal

Implement the first narrow audited workflow runner slice without breaking existing CLI, API, web, evidence, report, prove, or Stage Plan behaviour.

The slice should introduce:

1. `RunContract` domain/application type.
2. `StageExecutor` abstraction.
3. append-only audit event types/writer for audited flow runs.
4. high-level `executeAuditedFlow(contract)` use case.
5. one safe deterministic executor implementation or adapter using existing infrastructure where possible.
6. a CLI-accessible command or hidden/internal command that exercises the use case with a dry-run/no-write path.
7. tests proving the contracts, audit events, and stage sequencing.

Keep the implementation narrow. Prefer a working scaffold with strong types and tests over broad unfinished platform work.

## Non-goals

Do not:

- build a custom chatbot.
- implement a full MCP server in this slice unless the repo already has an obvious MCP package boundary ready.
- implement Claude, Gemini, Codex, Aider, and OpenCode all at once.
- let external chat clients orchestrate each internal step.
- replace existing classic run or Stage Plan flows.
- make the web app parse CLI stdout.
- move orchestration policy into the CLI, API route handlers, React components, or executor adapters.
- call a run fully audited if a stage happens outside MergeWright without captured input and output.
- perform large unrelated refactors.
- update another worker's active planning files unless the repo's coordination contract explicitly allows it.

## Architectural requirements

Respect existing architecture:

- CLI parses input and calls use cases.
- API routes are transport boundaries.
- Web UI is presentation/control only.
- Workflow/application services own sequencing.
- Executors run one stage and return structured output.
- Evidence/report/prove layers remain compatible.

Add new code near the existing application/domain/workflow boundaries. Use current package structure and naming conventions. Do not create a parallel architecture if existing packages already provide a suitable home.

## Proposed type shape

Adapt names and placement to repo conventions.

```ts
export type AuditedFlowStageKind =
  | 'plan'
  | 'build'
  | 'check'
  | 'review'
  | 'fix'
  | 'final-review'
  | 'approval'
  | 'report'
  | 'github';

export interface RunContract {
  id?: string;
  goal: string;
  workspace: string;
  flow: string;
  stages: RunContractStage[];
  requiredChecks?: string[];
  requiredEvidence?: string[];
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  stopBeforePr?: boolean;
  audit?: {
    mode: 'required' | 'best-effort';
  };
}

export interface RunContractStage {
  id: string;
  kind: AuditedFlowStageKind;
  executor: string;
  model?: string;
  required?: boolean;
  onlyIf?: string[];
}

export interface StageInput {
  runId: string;
  stage: RunContractStage;
  contract: RunContract;
  workspace: string;
  artefactsDir: string;
  previousResults: StageResult[];
}

export interface StageResult {
  stageId: string;
  kind: AuditedFlowStageKind;
  executor: string;
  status: 'passed' | 'failed' | 'skipped' | 'needs-approval';
  summary: string;
  artefacts?: Array<{
    kind: string;
    path: string;
  }>;
  changedFiles?: string[];
  metadata?: Record<string, unknown>;
}

export interface StageExecutor {
  id: string;
  capabilities: {
    stageKinds: AuditedFlowStageKind[];
    writesWorkspace: boolean;
    streamsOutput?: boolean;
  };
  run(input: StageInput): Promise<StageResult>;
}
```

## Audit event requirements

Add an append-only audit stream for audited flow runs.

Initial event types should cover:

- `run.created`
- `flow.selected`
- `stage.started`
- `prompt.generated` if the stage creates a prompt
- `executor.invoked`
- `executor.completed`
- `command.started` if shell commands are run
- `command.completed` if shell commands are run
- `files.changed` if changed files are captured
- `stage.completed`
- `run.completed`
- `run.failed`

The audit writer should write newline-delimited JSON where possible:

```text
.artifacts/runs/<run-id>/audit.ndjson
```

or to the current run artefact location if the repo already centralises run artefacts elsewhere.

Do not leak secrets into the audit log. Reuse existing redaction/safety utilities if they exist. If not, add a minimal redaction helper and tests for obvious sensitive keys like `token`, `secret`, `password`, and `apiKey`.

## Use case requirements

Create a high-level use case similar to:

```ts
executeAuditedFlow(contract: RunContract): Promise<AuditedFlowResult>
```

It should:

1. validate the contract.
2. create or resolve a run id.
3. create an artefacts directory.
4. write `run.created` and `flow.selected` audit events.
5. execute stages in order.
6. invoke matching `StageExecutor`s.
7. write stage start/completion events.
8. stop safely on failed required stages.
9. return a structured result with run id, status, stage results, and audit path.

For this first slice, it is acceptable for stage executors to be deterministic/no-op/dry-run where appropriate, as long as the sequencing and audit contract are real and tested.

## CLI requirement

Expose a low-risk way to exercise this use case.

Preferred command shape if it fits current CLI architecture:

```bash
npm run mergewright -- run-contract \
  --goal "add a HackerNews top stories page" \
  --workspace /path/to/repo \
  --flow feature-standard \
  --dry-run
```

Alternative acceptable shape:

```bash
npm run mergewright -- audited-flow-example \
  --goal "add a HackerNews top stories page" \
  --workspace /path/to/repo \
  --dry-run
```

The command should not require write execution. It should create an audited run artefact and print the run id and audit path.

## Testing requirements

Add focused tests for:

1. contract validation rejects missing goal/workspace/stages.
2. executor registry rejects unknown executors.
3. `executeAuditedFlow` runs stages in order.
4. failed required stage stops later stages.
5. skipped optional stage does not fail the run.
6. audit events are append-only and valid NDJSON.
7. audit log contains run, stage, executor, and completion events.
8. redaction removes obvious secret-like values from audit metadata.
9. CLI command returns deterministic output in dry-run mode, if CLI command is added.

Run the smallest relevant test/build commands available in the repo.

## Documentation requirements

Update or add documentation so the new direction is discoverable:

- Link `docs/product/05-audited-workflow-runner-direction.md` from the README or product roadmap.
- Add a short note that MCP is a trigger surface for high-level audited run execution, not the internal orchestration owner.
- Add a short note that the web app is now positioned as audit/approval/run visibility, not the only primary operator interface.

Keep doc updates concise.

## Acceptance criteria

This task is complete when:

- New Run Contract and Stage Executor types exist in the appropriate package/layer.
- `executeAuditedFlow` exists and is tested.
- The use case writes audit events for a staged run.
- At least one deterministic executor allows the flow to run in dry-run/no-write mode.
- A CLI or internal command can exercise the use case without workspace writes.
- Existing tests still pass or any failures are documented with exact commands and reasons.
- Product docs clearly point to the audited workflow runner direction.

## Output expected from Codex

When done, provide:

- summary of changes
- files changed
- tests run
- any tests not run and why
- known limitations
- suggested next slice

Suggested next slice after this one:

- expose `execute_audited_flow` through an MCP server package or app boundary.
- add a real shell check executor.
- add a Codex or Aider build executor behind the same `StageExecutor` interface.
- add web run detail support for `audit.ndjson` events.
