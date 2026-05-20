# MergeWright Documentation

MergeWright is a local-first CLI orchestrator for staged, auditable AI-assisted software delivery.

The CLI remains the automation and scripting surface. The accepted product direction is to make a TUI the primary human interface for local run inspection, artefact review, safety gates, and controlled workflow actions.

## Where to start

- New users: [getting-started/quick-start.md](./getting-started/quick-start.md)
- Workflow selection: [concepts/workflows.md](./concepts/workflows.md)
- End-to-end workflow guide: [workflows/classic-run.md](./workflows/classic-run.md) and [workflows/stage-plan.md](./workflows/stage-plan.md)

## Choose a workflow

- Classic run workflow: single stage file, phase flags/presets, optional bounded auto-chain.
- Stage Plan workflow: multi-stage human-gated flow with accept/fix/reassess progression.

Use Stage Plan for larger or multi-step changes with explicit review gates.

## Core docs

- Concepts: [concepts/overview.md](./concepts/overview.md)
- Artefacts: [concepts/artefacts.md](./concepts/artefacts.md)
- Safety model: [concepts/safety-model.md](./concepts/safety-model.md)
- Architecture: [architecture/overview.md](./architecture/overview.md)

## Product planning docs

- Product discovery: [product/01-product-discovery.md](./product/01-product-discovery.md)
- Product requirements: [product/02-product-requirements.md](./product/02-product-requirements.md)
- Roadmap: [product/04-roadmap.md](./product/04-roadmap.md)
- Decisions and open questions: [product/05-decisions-and-open-questions.md](./product/05-decisions-and-open-questions.md)
- TUI design: [ux/02-tui-design.md](./ux/02-tui-design.md)
- TUI implementation plan: [ux/03-tui-implementation-plan.md](./ux/03-tui-implementation-plan.md)

## CLI reference

- Command index: [cli/commands.md](./cli/commands.md)
- Classic run commands: [cli/run.md](./cli/run.md), [cli/continue-run.md](./cli/continue-run.md)
- Stage Plan commands: [cli/stage-plan-commands.md](./cli/stage-plan-commands.md)
- Reporting commands: [cli/reports.md](./cli/reports.md)
- Safety/provider commands: [cli/safety.md](./cli/safety.md), [cli/providers.md](./cli/providers.md)

## Safety docs

- Write mode: [safety/write-mode.md](./safety/write-mode.md)
- Write safety checks: [safety/write-safety.md](./safety/write-safety.md)
- Write audit and review gates: [safety/write-audit.md](./safety/write-audit.md)
- Auto-commit boundaries: [safety/auto-commit.md](./safety/auto-commit.md)

## Provider/backend docs

- Provider selection: [providers/provider-selection.md](./providers/provider-selection.md)
- Codex backend: [providers/codex-cli.md](./providers/codex-cli.md)
- OpenCode backend: [providers/opencode-cli.md](./providers/opencode-cli.md)
- Probe command: [providers/probing-opencode.md](./providers/probing-opencode.md)
- Config model: [configuration/execution-backends.md](./configuration/execution-backends.md)
