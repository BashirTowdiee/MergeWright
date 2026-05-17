# Product Discovery

## Product summary

Shepherds-Staff is a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.

It helps developers use AI coding agents in a controlled engineering process by separating work into phases such as:

```txt
Planner -> Builder -> Reviewer -> Fix Planner -> Fix Executor -> Checks -> Report
```

The current product surface is the CLI. Future surfaces may include a local web dashboard, VS Code extension, or desktop app.

## Product vision

Shepherds-Staff should become a trusted orchestration layer between developers and AI coding agents.

Long-term vision:

```txt
A developer can describe a complex software change, have Shepherds-Staff break it into safe stages, run the correct agent workflow, capture every artefact, enforce review gates, run checks, generate reports, and keep the developer in control at each critical decision point.
```

The product should make AI-assisted development safer, more repeatable, more auditable, and less dependent on ad-hoc prompting.

## Problem statement

AI coding tools are powerful, but day-to-day usage is often inconsistent and hard to trust.

Common problems:

- Prompts are inconsistent across tasks.
- The AI jumps straight to implementation without a clear plan.
- Review and fix loops are manual and unstructured.
- There is no durable run history.
- Artefacts are scattered across terminal output, chat history, and files.
- Write access can be risky.
- Multi-stage tasks are hard to supervise.
- It is difficult to compare what was planned against what changed.
- There is no standard way to generate a change report or PR summary.

Shepherds-Staff solves this by turning AI coding work into a structured workflow with explicit phases, bounded execution, persisted artefacts, and safety checks.

## Current product state

Current capabilities include:

- Project configuration.
- Stage files.
- Planner, builder, reviewer, fix planning, and fix execution phases.
- Dry-run mode.
- Read-only default execution.
- Explicit write mode.
- Write-safety checks.
- Run artefact capture.
- Run inspection.
- Run continuation.
- Auto-chain execution.
- Bounded fix retries.
- Plan HTML generation.
- Change report generation.
- PR summary generation.
- Live progress logging.
- Optional Codex stream output.

## Product hypothesis

Core hypothesis:

```txt
Developers will trust AI coding agents more when agent work is structured into staged, auditable, reviewable workflows with explicit safety boundaries.
```

Supporting hypotheses:

- Developers want AI coding workflows that feel closer to CI/CD pipelines than one-off chat prompts.
- Persistent run history makes agentic work easier to review and improve.
- Explicit planner, builder, and reviewer separation improves output quality.
- Human approval gates make auto-chain execution safer and more acceptable.
- Change reports and PR summaries increase confidence in AI-generated changes.
- A local-first model is more attractive to engineers than a hosted SaaS product early on.

## Target users

### Primary users

Senior software engineers who already use AI coding tools and want more control, structure, and safety.

They typically:

- Use Codex or similar tools.
- Work on non-trivial codebases.
- Care about reviewability.
- Want staged implementation.
- Want artefacts and reports.
- Do not want fully autonomous unsafe changes.

### Secondary users

- Tech leads supervising AI-assisted development.
- Open-source maintainers.
- Solo builders managing larger AI-generated changes.
- Engineering teams experimenting with AI coding workflows.
- Developers comparing multiple coding-agent providers.

### Not target users for now

- Non-technical users.
- Project managers who do not work with code.
- Large enterprise admins.
- Teams needing hosted collaboration.
- Users expecting a complete IDE replacement.

## Jobs to be done

Main job:

```txt
When I need to make a complex software change with AI assistance, I want the work broken into controlled stages so I can inspect, approve, fix, continue, and report on it safely.
```

Supporting jobs:

- When I start a task, I want a clear plan before implementation begins.
- When an implementation runs, I want to know exactly what phase is executing.
- When the AI changes code, I want artefacts, diffs, and audit data captured.
- When the reviewer finds issues, I want a controlled fix loop.
- When checks fail, I want the failure to block unsafe continuation.
- When a run completes, I want a useful change report and PR summary.
- When a run stops, I want to resume it without losing context.
- When I use write mode, I want explicit safety boundaries.

## Core product principles

### Human control over autonomy

The product should automate workflow steps, but not hide critical decisions.

### Read-only by default

Planning and review should be read-only. Write access should be explicit, gated, and auditable.

### Artefacts over memory

Every important phase should write durable artefacts. Every run should be inspectable after the fact.

### Structured phases over ad-hoc prompts

Planner, builder, reviewer, fix, checks, and report should remain distinct concepts.

### Local-first before hosted

A local developer tool is easier to trust, dogfood, and integrate with existing repositories.

### CLI remains foundational

The CLI is the automation backbone. Future GUI surfaces should expose orchestration state rather than duplicate orchestration logic.

## Existing workflow

Current workflow:

1. Configure a target project.
2. Create stage instructions.
3. Run Shepherds-Staff through the CLI.
4. Execute planner, builder, reviewer, fix, or auto-chain flow.
5. Capture prompts, logs, outputs, and metadata as artefacts.
6. Inspect results manually.
7. Run checks where configured.
8. Generate reports if needed.
9. Manually commit, push, or open PR.

Main pain points:

- Run state is not visual.
- Artefact inspection requires manual file navigation.
- Complex phase flows are hard to understand from terminal output alone.
- The relationship between plan, implementation, review, fix, checks, and report is not immediately visible.
- Auto-chain supervision could be clearer.

## Desired future workflow

Future workflow:

1. User defines a software change.
2. Shepherds-Staff generates or accepts a staged plan.
3. User chooses an execution mode.
4. Shepherds-Staff executes each phase with safety boundaries.
5. User reviews phase outputs and changed files.
6. User approves, requests fix, continues, stops, or commits.
7. Shepherds-Staff produces final reports and PR-ready summaries.
8. The full run remains inspectable and reproducible.

## Product positioning

Recommended positioning:

```txt
A local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.
```

Short positioning:

```txt
A local control plane for safe AI-assisted software development.
```

## Differentiation

Shepherds-Staff is differentiated by:

- Structured phase model.
- Explicit planner, builder, and reviewer separation.
- Read-only defaults.
- Write-safety gates.
- Post-write review requirements.
- Bounded fix attempts.
- Run continuation.
- Artefact capture.
- Change reports.
- PR summaries.
- Future provider flexibility.
- Future GUI observability.

The key product distinction is workflow trust.

## MVP scope

The current CLI is the existing MVP surface. The next product phase should formalise the product model around the current CLI and prepare for API and GUI surfaces.

In scope:

- CLI orchestration.
- Run lifecycle model.
- Project config.
- Stage config.
- Phase execution.
- Auto-chain flow.
- Write-safety model.
- Artefact model.
- Run metadata.
- Change reports.
- PR summaries.
- Plan visualisation.
- Provider abstraction planning.
- Local dashboard planning.

Out of scope for now:

- Hosted SaaS.
- Team accounts.
- Cloud run history.
- Multi-user collaboration.
- Enterprise admin controls.
- Cloud execution workers.
- Auto-push.
- Auto-merge.
- Unbounded autonomous execution.
- Replacing the developer's IDE.

## Product surfaces

### CLI

Best for automation, scripting, dogfooding, local workflows, advanced users, and repeatable commands.

### Local web dashboard

Best for run visibility, phase timelines, artefact browsing, review gates, change report inspection, live logs, and workflow control.

### VS Code extension

Best as a thin launcher and control surface after the local API and dashboard are stable.

### Desktop app

Only worth considering after the local web dashboard proves value.

## Key product questions

1. Should Shepherds-Staff remain Codex-specific, or become provider-agnostic?
2. Should the product optimise for manual phase control or human-gated auto-chain?
3. Should the product remain local-only, or leave room for hosted/team modes later?
4. Should Shepherds-Staff eventually support controlled commits?
5. Should GUI work start before more CLI features?

Initial recommendation:

- Provider-agnostic core, Codex as the first provider.
- Support both manual phase control and human-gated auto-chain.
- Local-first now, without blocking future hosted/team modes.
- Manual commit first, controlled auto-commit later.
- Stabilise run state, artefact manifest, and API boundaries before building a large GUI.

## Success criteria

- A developer can run a staged AI coding workflow safely.
- A developer can inspect every phase after completion.
- A failed review produces a clear fix path.
- A stopped run can be resumed without ambiguity.
- Write-mode execution is auditable.
- Reports are useful enough for PR preparation.
- The CLI remains reliable and scriptable.
- The product can support a GUI without duplicating orchestration logic.

## Discovery conclusion

Shepherds-Staff should be treated as more than a CLI.

Overall product direction:

```txt
Shepherds-Staff is a local-first control plane for safe, staged, auditable AI-assisted software development.
```

The CLI remains the foundation. GUI and editor surfaces should come later as visual control and observability layers.
