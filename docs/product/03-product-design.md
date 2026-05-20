# Product Design

## Product shape

MergeWright is designed as a local-first orchestration product with multiple surfaces over a shared core.

```txt
Core orchestration engine
  -> CLI
  -> local API, future
  -> local dashboard, future
  -> editor extension, future
```

The product should feel like a local control plane for AI-assisted software development rather than a generic prompt runner.

## Product surfaces

### CLI

The CLI is the current primary surface. It should remain scriptable, explicit, and safe by default.

Primary CLI responsibilities:

- Initialise projects.
- Run stages.
- Continue runs.
- Inspect runs.
- Open run artefacts.
- Run write-safety checks.
- Generate reports.
- Support auto-chain.

### Local dashboard

The dashboard should become a visual control and observability surface.

Primary dashboard responsibilities:

- Show projects and runs.
- Show phase timelines.
- Show live execution state.
- Show artefacts.
- Show review gates.
- Show changed files and reports.
- Trigger safe continuation or fix actions.

### Editor extension

The editor extension should be a thin launcher and status surface, not the orchestration core.

## Product model

Core concepts:

- Project
- Workspace
- Stage
- Run
- Phase
- Provider
- Prompt
- Artefact
- Check
- Review result
- Fix attempt
- Report
- Safety gate

## User experience principles

- Make state visible.
- Make risky actions explicit.
- Keep advanced options available without overwhelming the default flow.
- Prefer inspectable artefacts over hidden state.
- Make failure states actionable.

## Main product flows

### Safe preview

1. User chooses project and stage.
2. User runs dry-run.
3. MergeWright shows projected phases and safety state.
4. No target repository writes occur.

### Manual phase execution

1. User runs planner.
2. User inspects plan.
3. User runs builder.
4. User runs reviewer.
5. User handles fix/check/report actions deliberately.

### Human-gated auto-chain

1. User starts auto-chain.
2. MergeWright executes bounded phases.
3. Review and fix decisions are captured.
4. Checks run only when safety rules permit.
5. Reports are generated after successful completion.

## Design boundaries

MergeWright should not hide generated changes, bypass review, or treat provider output as trusted by default.

Future UI surfaces should expose the same product model as the CLI rather than inventing a parallel workflow.
