# Roadmap

## Status

Proposed roadmap, updated for the accepted TUI-primary interface direction.

## Roadmap purpose

This roadmap turns the product direction into staged delivery. Shepherds-Staff should keep the CLI as the automation surface and make the TUI the main human interface for local agent workflow supervision.

## Roadmap principles

- Do not build interface behaviour that requires duplicated orchestration logic.
- Do not add provider flexibility before the provider contract is clear.
- Do not add auto-commit before manual approval flows are robust.
- Preserve local-first operation throughout the roadmap.
- Stabilise state and artefact contracts before adding a central TUI.
- Prefer thin vertical slices over broad unfinished platform work.
- Treat web/API/editor surfaces as optional future complements, not the next primary interface.

## Phase 1: Product foundation

Goal: formalise Shepherds-Staff as a product, not only a CLI implementation.

Deliverables:

- Product discovery.
- Product requirements.
- Product design.
- Decision and open-question register.
- TUI design direction.
- Architecture plan.
- Run lifecycle definition.
- Artefact model definition.
- Provider abstraction direction.

Exit criteria:

- Product positioning is clear.
- TUI is documented as the primary human interface.
- CLI is documented as the automation surface.
- Current, proposed, and future scope are separated.
- Product docs can guide implementation prompts.

## Phase 2: CLI maturity and state contract

Goal: make the current CLI foundation stable, inspectable, and ready for the TUI.

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

## Phase 3: TUI read-only inspector

Goal: provide the first terminal-native run inspector over existing run data.

Deliverables:

- Active project/repository context.
- Recent run list.
- Selected run summary.
- Phase flow view.
- Artefact list.
- Artefact preview.
- Review finding view.
- Check/result view where available.
- Safe next action display.

Exit criteria:

- A user can understand a completed, blocked, or failed run without manually opening run directories.
- The TUI reads structured run metadata and artefact indexes.
- The TUI does not shell out to CLI commands and parse terminal text for core state.

## Phase 4: TUI workflow controls

Goal: add safe local workflow actions to the TUI after state contracts are stable.

Deliverables:

- Start dry-run.
- Start read-only run.
- Continue run.
- Stop run.
- Request fix.
- Generate change report.
- Generate PR summary.
- Open artefact in editor.
- Open run directory.

Exit criteria:

- TUI actions preserve CLI safety semantics.
- Risky actions are explicit and test-covered.
- Mutating actions return updated run state and blocked reasons.

## Phase 5: Write-aware TUI workflow

Goal: make write-enabled workflows safe and explicit inside the TUI.

Deliverables:

- Write-safety status panel.
- Explicit write-mode confirmation.
- Post-write review gate display.
- Blocked-state explanation.
- Fix attempt history.
- Review retry history.

Exit criteria:

- Write-enabled actions cannot bypass safety gates.
- The user can see why a run is blocked and what safe action is available.
- The TUI remains keyboard-first and local-first.

## Phase 6: Provider flexibility

Goal: move from Codex-specific execution toward provider-agnostic orchestration.

Deliverables:

- Provider interface.
- Codex provider adapter.
- Provider capability matrix.
- Provider config validation.
- Provider/model metadata in TUI run views.
- Initial support for additional providers where practical.

Exit criteria:

- Provider behaviour is isolated.
- Run metadata records provider/model information.
- Safety semantics are independent from provider selection unless explicitly documented.

## Phase 7: Optional API/web/editor surfaces

Goal: add complementary surfaces only after the TUI and core service boundaries prove useful.

Deliverables, if still useful:

- Local API for external integrations.
- Web dashboard for rich Markdown/diff rendering or demos.
- VS Code launcher/editor bridge.

Exit criteria:

- Optional surfaces reuse the same application services as CLI and TUI.
- Optional surfaces do not become parallel orchestration implementations.

## Phase 8: Workflow polish

Goal: make Shepherds-Staff easier to use, demonstrate, and adopt.

Deliverables:

- Plan editor or plan review workflow.
- Stage generator.
- Controlled commit support.
- PR summary workflow.
- Portfolio-ready documentation and examples.

Exit criteria:

- Users can understand, run, inspect, and review Shepherds-Staff workflows with minimal maintainer guidance.
- The TUI feels like the central local cockpit for AI-assisted software development.
