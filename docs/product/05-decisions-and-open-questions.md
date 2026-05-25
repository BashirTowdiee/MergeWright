# Decisions and Open Questions

## Status

This document tracks product and architecture decisions that affect MergeWright delivery.

Use this file to prevent unresolved assumptions from being hidden inside discovery, roadmap, API, or UX docs.

## Decision status labels

- Proposed: recommended but not confirmed.
- Accepted: confirmed direction.
- Deferred: intentionally postponed.
- Rejected: explicitly not pursuing.
- Open: needs a decision.

## Decisions

### D001: Product identity

Status: Accepted

Decision:

```txt
MergeWright should be positioned as a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.
```

Rationale:

This keeps the product broader than a Codex wrapper while still focused on software engineering workflows.

Implications:

- CLI remains a product surface, not the whole product identity.
- Web app becomes the primary human product surface.
- Future API/dashboard/editor/desktop surfaces should reuse the same orchestration model.
- Documentation should use product-level language instead of only command-level language.

### D002: CLI remains foundational

Status: Accepted

Decision:

```txt
The CLI remains the automation backbone for scripts, exact commands, CI-style usage, and dogfooding.
```

Rationale:

The CLI already exists and is suitable for dogfooding, scripts, and staged workflows.

Implications:

- CLI compatibility should be protected during refactors.
- CLI should reuse shared application services rather than becoming a separate orchestration implementation.
- CLI remains useful after the web app becomes the main human interface.

### D003: Web app is the primary human interface

Status: Accepted

Decision:

```txt
The web app is the chosen primary human interface for MergeWright. The TUI path is superseded.
```

Rationale:

MergeWright needs a rich operator control room for run history, phase timelines, artefacts, diffs, reviewer findings, safe actions, approval gates, PR state, CI state, and audit history. A web app is a better fit for these workflows than a terminal UI. The web app should be backed by a Fastify API and shared application services, not by CLI stdout parsing.

Implications:

- Roadmap should prioritise shared state contracts, application services, Fastify API, and Next.js web UI.
- TUI work is no longer a product target and should not receive new feature investment.
- Existing TUI code may be mined for reusable command, event, read-model, and safety abstractions.
- TUI-specific code should be removed or quarantined after the web app reaches useful run-inspection parity.
- Web UI implementation should focus on run inspection, phase flow, artefact preview, review findings, safety gates, live events, and safe next actions.

### D004: Local-first before hosted

Status: Accepted

Decision:

```txt
MergeWright should remain local-first for the current product horizon.
```

Rationale:

Local-first operation is easier to trust, easier to dogfood, and aligns with target repository workflows.

Implications:

- The first API/web implementation should run locally.
- No hosted auth, team accounts, cloud workers, or remote run history in current scope.
- Local filesystem remains the default artefact store.
- Future hosted/team modes should not drive current architecture.

### D005: Filesystem remains inspectable source of artefacts

Status: Proposed

Decision:

```txt
Run directories and machine-readable files should remain inspectable. A database should index/query run history, events, audit records, and artefact metadata.
```

Rationale:

The existing product already persists artefacts to disk, and direct file inspection is useful for developer trust. The web app also needs efficient durable queries, event history, and audit trails.

Implications:

- `run.json`, artefact metadata, and events should be stabilised before advanced web controls.
- A database should be introduced as a durable index/store rather than hiding all artefacts from the filesystem.
- Postgres + Drizzle is the preferred target for the web-first path.

### D006: Provider-agnostic direction

Status: Open

Decision needed:

```txt
Should MergeWright formally commit to a provider-agnostic execution contract, with Codex as the first provider?
```

Default recommendation:

Yes, but only after the run state, artefact, command, and event contracts are stable.

Implications if accepted:

- Add provider interface and capability matrix.
- Isolate Codex-specific flags and output parsing.
- Record provider/model metadata in run state.
- Surface provider/model metadata in the web app.

Implications if rejected:

- Keep the product clearly Codex-specific.
- Simplify implementation.
- Narrow product positioning to Codex orchestration.

### D007: Controlled commit support

Status: Open

Decision needed:

```txt
Should MergeWright eventually support controlled local commits after review gates pass?
```

Default recommendation:

Yes later, but not before manual approval flows, reports, and write-safety state are stable.

Implications if accepted:

- Add explicit commit design.
- Add commit message generation and review.
- Add strong no-push/no-merge boundaries unless separately designed.
- Add explicit web confirmation and review state.

### D008: Local API command name

Status: Open

Decision needed:

```txt
Should the local API/web control room be launched through `ui`, `server`, `dashboard`, `web`, or another command?
```

Default recommendation:

Use separate explicit development commands first, for example `api` and `web`, then add a convenience launcher once the architecture stabilises.

### D009: Dashboard timeline implementation

Status: Deferred

Decision needed:

```txt
Should the first dashboard use React Flow or simple ordered phase cards?
```

Default recommendation:

Start with simple ordered phase cards. Add graph/timeline libraries only after the run model proves stable.

### D010: TUI framework choice

Status: Rejected

Decision:

```txt
Do not continue the central TUI implementation as a product path.
```

Rationale:

The product direction has moved to a web-first interface. Ink was previously accepted for a TUI implementation, but the TUI itself is no longer the intended primary human interface.

Implications:

- Do not add more Ink/TUI features.
- Do not build new roadmap stages around TUI panes, overlays, or command palette behaviour.
- Existing TUI code can remain temporarily until reusable internals are extracted and web parity exists.
- Remove Ink and `src/tui/**` once no longer required.

### D011: Fastify API boundary

Status: Accepted

Decision:

```txt
The web app should talk to a Fastify API that owns the HTTP boundary and calls shared application services.
```

Rationale:

MergeWright's core value is orchestration, safety, run state, events, artefacts, and auditability. Keeping these behind a Fastify API prevents the web app from becoming a second orchestration implementation.

Implications:

- Fastify routes should validate HTTP input/output and call use cases.
- Route handlers should not own orchestration logic.
- Web UI should not spawn commands, parse CLI output, or mutate workspace files directly.
- CLI and API should share application services where practical.

## Open questions requiring maintainer input

1. Should provider-agnostic execution be a committed product direction, or should the product stay Codex-specific for now?
2. Should controlled local commits be a future product goal, or should MergeWright permanently leave commits to the user?
3. Should hosted/team modes be excluded entirely to keep the product local-only?
4. Should run metadata use a clean public schema even if it differs from current internal names, or should it mirror existing implementation names exactly?
5. Should the first durable store be Postgres immediately, or should a SQLite/local store be used as a stepping stone?
6. What should the canonical local launcher command be for API + web once both exist?

## Decision review cadence

Review this file before starting any stage that affects:

- provider support
- run metadata schema
- artefact schema
- event schema
- write safety
- commit automation
- API/web boundaries
- persistence choice
- release/distribution model
- TUI removal assumptions
