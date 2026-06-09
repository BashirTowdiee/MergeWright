# Audited Workflow Runner Direction

## Status

Accepted product direction update.

This document updates MergeWright's product direction from a web-first delivery harness toward an audited workflow runner for AI-assisted software changes.

The existing delivery-harness direction remains useful. Evidence manifests, stage contracts, reviewer gates, reports, readiness checks, and backend-agnostic execution are still core. The change is the product surface strategy and the unit of control.

MergeWright should not primarily be a chatbot, a generic multi-agent runtime, or a web app that reproduces a terminal workflow. It should own auditable software delivery runs that can be triggered from multiple surfaces.

## Core product position

MergeWright is an audited workflow runner for coding agents.

Core promise:

> Run AI-assisted software changes through controlled, repeatable, fully audited delivery flows.

The product should answer:

> What happened, who or what performed each stage, what changed, what evidence was collected, what checks ran, what review gates passed or failed, and whether the result is safe to merge?

Coding agents and model harnesses produce work. MergeWright owns the run contract, stage sequencing, evidence capture, gates, reviews, checks, fix loops, and audit record.

## Product model

The central product primitive should be a Run Contract.

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

Example flow:

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

The flow decides what happens. Executors decide who or what performs each stage. MergeWright owns the transition rules and audit log.

## Surface strategy

The main surfaces should be:

1. MCP trigger surface
2. CLI control and automation surface
3. GitHub App or GitHub Action team surface
4. Web dashboard for run visibility, approvals, artefacts, and audit review

The web app remains useful, but it should not be the only or primary product entry point. It should become the best place to inspect, approve, compare, and share audited runs.

### MCP

MCP should trigger audited runs. MCP clients should not orchestrate internal MergeWright steps.

Preferred MCP shape:

```text
execute_audited_flow(runContract)
get_run(runId)
get_run_events(runId)
approve_stage(runId, stageId)
cancel_run(runId)
export_audit(runId)
```

Avoid exposing lots of low-level tools that let an external chatbot decide each internal step. That breaks the audit boundary.

Bad shape:

```text
inspect_repo -> suggest_flow -> invoke_agent -> run_checks -> review_diff -> open_pr
```

Better shape:

```text
execute_audited_flow -> MergeWright owns inspect, plan, build, checks, review, fix, final review, and artefacts
```

### CLI

The CLI should remain valuable, but not as the main natural-language chatbot.

CLI responsibilities:

- initialise local project config
- start MCP server
- run explicit flows
- inspect runs
- resume or cancel runs
- approve stages
- export audit records
- run in CI
- debug executor setup

Representative commands:

```bash
mw init
mw mcp
mw run feature --goal "add a HackerNews top stories page" --agent codex
mw runs
mw audit <run-id>
mw logs <run-id>
mw approve-stage <run-id> <stage-id>
mw export-audit <run-id> --format json
mw doctor
```

### GitHub

GitHub should become the strongest team adoption path.

Target usage:

```text
@mergewright review
@mergewright fix-ci
@mergewright prove
@mergewright run feature from issue #123
```

GitHub integration should post structured run summaries, readiness decisions, changed files, check results, review findings, and audit links back to the PR.

### Web dashboard

The web dashboard should focus on visibility and control:

- run list
- run detail
- stage timeline
- live events
- prompts sent to executors
- executor outputs
- changed files
- diffs
- check results
- review verdicts
- approval gates
- risk and readiness summary
- audit export
- PR status

It should not own orchestration logic. It should call the same application services as CLI, MCP, and GitHub surfaces.

## Audit boundary

A run is useful only if the full controlled flow is auditable.

MergeWright should audit:

- initial request
- resolved run contract
- selected flow
- selected stage executors
- prompt generated for each stage
- model or harness used for each stage where known
- repo state before execution
- branch and commit SHA before execution
- shell commands
- stdout and stderr paths
- exit codes
- files changed
- diffs
- check output
- review prompts
- review verdicts
- fix prompts
- fix-loop history
- approvals
- blocked reasons
- branch and commit SHA after execution
- PR actions
- final readiness decision

The audit rule:

> A stage is auditable only if MergeWright invokes it or captures its full input, output, artefacts, and resulting workspace state.

Manual copy and paste between tools is allowed only as degraded mode and should be marked as incomplete audit coverage.

## Stage executor abstraction

Introduce a Stage Executor abstraction separate from current runner concepts.

A Stage Executor should:

- declare supported stage kinds
- declare read/write capability
- declare streaming support if available
- accept a structured StageInput
- return a structured StageResult
- write raw logs and normalised metadata
- avoid owning readiness decisions

Sketch:

```ts
interface StageExecutor {
  id: string;
  capabilities: StageExecutorCapabilities;
  run(input: StageInput): Promise<StageResult>;
}

type StageKind =
  | 'plan'
  | 'build'
  | 'check'
  | 'review'
  | 'fix'
  | 'final-review'
  | 'approval'
  | 'report'
  | 'github';
```

Executors may wrap Codex, Aider, Claude Code, OpenCode, Gemini, Claude, shell commands, GitHub, or human approval.

MergeWright remains responsible for:

- flow selection
- stage sequencing
- prompt construction
- policy enforcement
- evidence collection
- review gating
- merge-readiness evaluation
- audit output

Executors remain responsible for:

- performing one stage
- returning structured result metadata
- exposing raw logs and artefacts

## Non-goals

- Do not build a full custom chatbot as the main product surface.
- Do not make Codex, Claude, Gemini, Aider, OpenCode, or any single executor the product centre.
- Do not let MCP clients orchestrate internal steps one tool at a time.
- Do not call a run fully audited if stages were performed outside MergeWright without captured inputs and outputs.
- Do not make the web app parse CLI stdout.
- Do not make the CLI own delivery policy.
- Do not hide missing evidence or missing checks behind optimistic summaries.

## Roadmap impact

The previous web-first roadmap should be adjusted as follows:

1. Keep evidence manifests, stage contracts, reports, prove, focused reviews, and backend-agnostic runner work.
2. Promote Run Contract to the primary product primitive.
3. Add Stage Executor contracts before expanding backend support.
4. Add `execute_audited_flow` as the high-level application use case.
5. Add MCP as a trigger surface over `execute_audited_flow`.
6. Keep CLI commands as explicit run/control/audit operations.
7. Reposition the web app as an audit, approval, and run-visibility dashboard.
8. Add GitHub App or GitHub Action integration as the team adoption path.

## Recommended next implementation slice

Build the smallest vertical slice around one audited run contract.

Target flow:

```text
plan -> build -> check -> review -> fix-if-needed -> final-review
```

Initial implementation may use existing runner infrastructure, but the public contract should be stage-executor-shaped.

Acceptance criteria:

- A `RunContract` type exists.
- A `StageExecutor` type exists.
- A high-level `executeAuditedFlow(contract)` use case exists.
- The use case writes an append-only audit event stream.
- The flow records stage prompts, executor metadata, command output paths, changed files, diffs, check results, and review verdicts.
- The flow can run from CLI through an explicit command.
- The same use case can be exposed through a future MCP endpoint without changing orchestration logic.
- Existing evidence/report/prove behaviour remains compatible.

## Success definition

MergeWright succeeds when a developer or team can say:

```text
Run this AI-assisted change through our standard audited flow.
```

And MergeWright can prove:

```text
what was requested
what plan was used
which executor did each stage
what prompts were sent
what files changed
what checks ran
what reviews passed or failed
what fixes were applied
who approved risky stages
whether the final result is merge-ready
```
