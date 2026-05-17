# Roadmap

## Roadmap purpose

This roadmap turns the product direction into staged delivery. It is intentionally product-led rather than implementation-only.

## Phase 1: Product foundation

Goal: formalise Shepherds-Staff as a product, not only a CLI implementation.

Deliverables:

- Product discovery.
- Product requirements.
- Product design.
- Architecture plan.
- Run lifecycle definition.
- Artefact model definition.
- Provider abstraction direction.

## Phase 2: CLI maturity

Goal: make the current CLI foundation stable, inspectable, and ready for additional surfaces.

Deliverables:

- Tighten run state model.
- Improve continuation semantics.
- Improve auto-chain controls.
- Improve change report output.
- Improve README and examples.
- Add a stable artefact index.
- Ensure CLI output and metadata align.

## Phase 3: Local API layer

Goal: expose the orchestration core through a local API without duplicating CLI logic.

Deliverables:

- Projects endpoint.
- Runs endpoint.
- Run detail endpoint.
- Artefacts endpoint.
- Phase state endpoint.
- Live events stream.
- Review, continue, stop, and fix actions.

## Phase 4: GUI MVP

Goal: provide a visual control and observability surface over existing runs and new executions.

Deliverables:

- Run list.
- Run detail.
- Phase timeline.
- Live logs.
- Artefact viewer.
- Review gate panel.
- Change report panel.

## Phase 5: Provider flexibility

Goal: move from Codex-specific execution toward provider-agnostic orchestration.

Deliverables:

- Provider interface.
- Codex provider adapter.
- Provider capability matrix.
- Provider config validation.
- Initial support for additional providers where practical.

## Phase 6: Workflow polish

Goal: make Shepherds-Staff easier to use, demonstrate, and adopt.

Deliverables:

- Plan editor or plan review workflow.
- Stage generator.
- Controlled commit support.
- PR summary workflow.
- VS Code launcher.
- Portfolio-ready documentation and examples.

## Roadmap principles

- Do not build GUI behaviour that requires duplicated orchestration logic.
- Do not add provider flexibility before the provider contract is clear.
- Do not add auto-commit before manual approval flows are robust.
- Preserve local-first operation throughout the roadmap.
