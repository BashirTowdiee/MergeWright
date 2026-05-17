# Roadmap

## Status

Proposed roadmap. Sequencing should be adjusted as product decisions are resolved.

## Roadmap purpose

This roadmap turns the product direction into staged delivery. It is intentionally product-led rather than implementation-only.

## Roadmap principles

- Do not build GUI behaviour that requires duplicated orchestration logic.
- Do not add provider flexibility before the provider contract is clear.
- Do not add auto-commit before manual approval flows are robust.
- Preserve local-first operation throughout the roadmap.
- Stabilise state and artefact contracts before adding new product surfaces.
- Prefer thin vertical slices over broad unfinished platform work.

## Phase 1: Product foundation

Goal: formalise Shepherds-Staff as a product, not only a CLI implementation.

Deliverables:

- Product discovery.
- Product requirements.
- Product design.
- Decision and open-question register.
- Architecture plan.
- Run lifecycle definition.
- Artefact model definition.
- Provider abstraction direction.

Exit criteria:

- Product positioning is clear.
- Current, proposed, and future scope are separated.
- Open decisions are documented.
- Product docs can guide implementation prompts.

## Phase 2: CLI maturity and state contract

Goal: make the current CLI foundation stable, inspectable, and ready for additional surfaces.

Deliverables:

- Tighten run state model.
- Define public run status and phase status names.
- Add or formalise artefact index.
- Add lifecycle event output, where missing.
- Improve continuation semantics.
- Improve auto-chain controls.
- Improve change report output.
- Improve README and examples.
- Ensure CLI output and metadata align.

Exit criteria:

- A run can be inspected through machine-readable files without parsing arbitrary Markdown.
- Run status, phase status, blocked reason, available actions, and artefact references are stable.
- Existing CLI behaviour remains compatible.

## Phase 3: Local API, read-only first

Goal: expose the orchestration state through a local API without duplicating CLI logic.

Deliverables:

- Projects endpoint.
- Stages endpoint.
- Runs endpoint.
- Run detail endpoint.
- Artefacts endpoint.
- Reports endpoint.
- Events endpoint.

Exit criteria:

- A dashboard can list projects and runs.
- A dashboard can render a run detail page.
- The API reads from the same run metadata and artefact model used by the CLI.

## Phase 4: Dashboard inspection MVP

Goal: provide a visual read-only control and observability surface over existing runs.

Deliverables:

- Project list.
- Run list.
- Run detail.
- Phase timeline.
- Artefact viewer.
- Change report panel.
- Events/logs panel.

Exit criteria:

- A user can understand a completed or failed run without manually opening run directories.
- The dashboard adds product value before execution controls exist.

## Phase 5: Local API and dashboard execution controls

Goal: add safe workflow actions after the state and safety contracts are stable.

Deliverables:

- Start dry-run.
- Start read-only run.
- Continue run.
- Stop run.
- Request fix.
- Generate reports.
- Add explicit confirmation model for write-enabled actions.

Exit criteria:

- Dashboard actions preserve CLI safety semantics.
- Mutating API endpoints return updated run state and blocked reasons.
- Risky actions are explicit and test-covered.

## Phase 6: Provider flexibility

Goal: move from Codex-specific execution toward provider-agnostic orchestration.

Deliverables:

- Provider interface.
- Codex provider adapter.
- Provider capability matrix.
- Provider config validation.
- Initial support for additional providers where practical.

Exit criteria:

- Provider behaviour is isolated.
- Run metadata records provider/model information.
- Safety semantics are independent from provider selection unless explicitly documented.

## Phase 7: Workflow polish

Goal: make Shepherds-Staff easier to use, demonstrate, and adopt.

Deliverables:

- Plan editor or plan review workflow.
- Stage generator.
- Controlled commit support.
- PR summary workflow.
- VS Code launcher.
- Portfolio-ready documentation and examples.

Exit criteria:

- Users can understand, run, inspect, and review Shepherds-Staff workflows with minimal maintainer guidance.
- Optional editor integration improves workflow convenience without replacing the core CLI/API/dashboard model.
