# Product Discovery

## Status

Accepted product direction. This document frames MergeWright as a product beyond the current CLI implementation. Current runtime behaviour should still be verified against the root README and code.

## Product summary

MergeWright is a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.

It helps developers use AI coding agents in a controlled engineering process by separating work into explicit phases:

```txt
Planner -> Builder -> Reviewer -> Fix Planner -> Fix Executor -> Checks -> Report
```

The CLI is the current implemented surface and remains the automation/scripting interface. The accepted primary human interface direction is a terminal UI, TUI. Future surfaces may include a local API, web dashboard, VS Code extension, or desktop app, but those are optional complements rather than the next core interface.

## Product vision

MergeWright should become a trusted orchestration layer between developers and AI coding agents.

Long-term vision:

```txt
A developer can describe a complex software change, have MergeWright break it into safe stages, run the correct agent workflow, capture every artefact, enforce review gates, run checks, generate reports, and keep the developer in control at each critical decision point.
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

MergeWright solves this by turning AI coding work into a structured workflow with explicit phases, bounded execution, persisted artefacts, and safety checks.

## Current product state

Current CLI capabilities include:

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

- Developers want AI coding workflows that feel closer to controlled local developer tooling than one-off chat prompts.
- Persistent run history makes agentic work easier to review and improve.
- Explicit planner, builder, and reviewer separation improves output quality.
- Human approval gates make auto-chain execution safer and more acceptable.
- Change reports and PR summaries increase confidence in AI-generated changes.
- A terminal-native interface is a stronger fit than a SaaS-style dashboard for the first main human interface.

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
- Prefer local, keyboard-driven developer tools.

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
When I need to make a complex software change with AI assistance, I want the work broken into controlled stages so I can inspect, approve, fix, continue, and report on it safely from my local development environment.
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
- When I supervise a run, I want a keyboard-first TUI that keeps run state, artefacts, logs, and safe next actions visible.

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

### TUI as the primary human interface

The TUI should become the main interactive product surface for run inspection, artefact review, safety gates, and human-in-the-loop actions.

### CLI remains foundational

The CLI remains the automation backbone for scripts, exact command execution, local CI-style usage, and dogfooding. The TUI should reuse shared application services rather than shelling out and parsing CLI text.

## Existing workflow

Current workflow:

1. Configure a target project.
2. Create stage instructions.
3. Run MergeWright through the CLI.
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

1. User opens the MergeWright TUI from a target repository.
2. User selects or creates a staged run.
3. MergeWright executes phases with safety boundaries.
4. The TUI shows current run state, phase flow, artefacts, logs, changed files, review findings, and safe next actions.
5. User approves, requests fix, continues, stops, or generates reports through explicit TUI actions.
6. The CLI remains available for automation and scripted commands.
7. The full run remains inspectable and reproducible from persisted artefacts.

## Product positioning

Recommended positioning:

```txt
A terminal-native control plane for safe, staged, auditable AI-assisted software development.
```

Short positioning:

```txt
A local TUI for supervising AI coding workflows.
```

## Differentiation

MergeWright is differentiated by:

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
- TUI-first human-in-the-loop operation.
- Future provider flexibility.

The key product distinction is workflow trust.

## MVP boundary

The CLI is the current MVP surface. The next product phase should formalise the product model around the CLI and prepare for a central TUI.

Current or near-term scope:

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
- TUI run inspector planning.

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
- Web dashboard as the primary interface.

## Product surfaces

### CLI

Current. Best for automation, scripting, dogfooding, local workflows, advanced users, and repeatable commands.

### TUI

Accepted primary human interface. Best for run selection, phase inspection, artefact browsing, review findings, safe next actions, fix loops, report generation, and keyboard-first local operation.

### Local API

Future/optional. Useful if a later web or editor surface needs a process boundary, but not required before the TUI can start if shared application services are available.

### Local web dashboard

Future/optional. Useful for richer Markdown/diff rendering or demos, but no longer the primary next product surface.

### VS Code extension

Future. Best as a thin launcher and editor integration after the TUI and core service boundaries are stable.

### Desktop app

Future. Only worth considering after the terminal-native workflow proves value.

## Key product questions

1. Should MergeWright remain Codex-specific, or become provider-agnostic?
2. Should the product optimise for manual phase control or human-gated auto-chain?
3. Should the product remain local-only, or leave room for hosted/team modes later?
4. Should MergeWright eventually support controlled commits?
5. Should the central TUI use Ink, OpenTUI/Solid, or another framework?

Initial recommendation:

- Provider-agnostic core, Codex as the first provider.
- Support both manual phase control and human-gated auto-chain.
- Local-first now, without blocking future hosted/team modes.
- Manual commit first, controlled auto-commit later.
- Stabilise run state, artefact manifest, and application service boundaries before building a large TUI.
- Spike Ink and OpenTUI/Solid before committing to the central TUI framework.

## Success criteria

- A developer can run a staged AI coding workflow safely.
- A developer can inspect every phase after completion.
- A failed review produces a clear fix path.
- A stopped run can be resumed without ambiguity.
- Write-mode execution is auditable.
- Reports are useful enough for PR preparation.
- The CLI remains reliable and scriptable.
- The TUI can support the main human workflow without duplicating orchestration logic.

## Discovery conclusion

MergeWright should be treated as more than a CLI.

Overall product direction:

```txt
MergeWright is a terminal-native control plane for safe, staged, auditable AI-assisted software development.
```

The CLI remains the automation foundation. The TUI becomes the primary human interface. Web and editor surfaces should come later as optional complements, not the next core product surface.
