# Decisions and Open Questions

## Status

This document tracks product and architecture decisions that affect Shepherds-Staff delivery.

Use this file to prevent unresolved assumptions from being hidden inside discovery, roadmap, API, or UX docs.

## Decision status labels

- Proposed: recommended but not confirmed.
- Accepted: confirmed direction.
- Deferred: intentionally postponed.
- Rejected: explicitly not pursuing.
- Open: needs a decision.

## Decisions

### D001: Product identity

Status: Proposed

Decision:

```txt
Shepherds-Staff should be positioned as a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.
```

Rationale:

This keeps the product broader than a Codex wrapper while still focused on software engineering workflows.

Implications:

- CLI remains a product surface, not the whole product identity.
- Future API/dashboard/editor surfaces should reuse the same orchestration model.
- Documentation should use product-level language instead of only command-level language.

### D002: CLI remains foundational

Status: Proposed

Decision:

```txt
The CLI remains the automation backbone and source of truth until shared application services and a local API are stable.
```

Rationale:

The CLI already exists and is suitable for dogfooding, scripts, and staged workflows.

Implications:

- GUI work should not duplicate orchestration logic.
- API/dashboard work should follow state contract work.
- CLI compatibility should be protected during refactors.

### D003: Dashboard implementation order

Status: Proposed

Decision:

```txt
The first dashboard slice should be read-only over existing run data.
```

Rationale:

This validates run visibility, phase timelines, artefact browsing, and report viewing without introducing execution, cancellation, or write-safety risks.

Implications:

- API MVP should expose read-only endpoints first.
- Execution controls should come after mutation contracts and safety behaviour are tested.
- Dashboard UX can prove value before full workflow control exists.

### D004: Local-first before hosted

Status: Proposed

Decision:

```txt
Shepherds-Staff should remain local-first for the current product horizon.
```

Rationale:

Local-first operation is easier to trust, easier to dogfood, and aligns with target repository workflows.

Implications:

- No hosted auth, team accounts, cloud workers, or remote run history in current scope.
- Local filesystem remains the default artefact store.
- Future hosted/team modes should not drive current architecture.

### D005: Filesystem remains source of truth

Status: Proposed

Decision:

```txt
Run directories and machine-readable files should remain the source of truth. A local database may be added later as an index/cache.
```

Rationale:

The existing product already persists artefacts to disk, and direct file inspection is useful for developer trust.

Implications:

- `run.json`, `artefacts.json`, and `events.jsonl` should be stabilised before a dashboard.
- SQLite should not be required for the first read-only dashboard unless filesystem scanning is too slow.

### D006: Provider-agnostic direction

Status: Open

Decision needed:

```txt
Should Shepherds-Staff formally commit to a provider-agnostic execution contract, with Codex as the first provider?
```

Default recommendation:

Yes, but only after the run state and artefact contracts are stable.

Implications if accepted:

- Add provider interface and capability matrix.
- Isolate Codex-specific flags and output parsing.
- Record provider/model metadata in run state.

Implications if rejected:

- Keep the product clearly Codex-specific.
- Simplify implementation.
- Narrow product positioning to Codex orchestration.

### D007: Controlled commit support

Status: Open

Decision needed:

```txt
Should Shepherds-Staff eventually support controlled local commits after review gates pass?
```

Default recommendation:

Yes later, but not before manual approval flows, reports, and write-safety state are stable.

Implications if accepted:

- Add explicit commit design.
- Add commit message generation and review.
- Add strong no-push/no-merge boundaries unless separately designed.

### D008: Local API command name

Status: Open

Decision needed:

```txt
Should the local API/dashboard be launched through `ui`, `server`, `dashboard`, or another command?
```

Default recommendation:

Use `ui` if the command starts both API and dashboard. Use `server` if it only starts the API.

### D009: Dashboard timeline implementation

Status: Open

Decision needed:

```txt
Should the first dashboard use React Flow or simple ordered phase cards?
```

Default recommendation:

Start with simple ordered phase cards. Move to React Flow after the phase/state model stabilises.

## Open questions requiring maintainer input

1. Should provider-agnostic execution be a committed product direction, or should the product stay Codex-specific for now?
2. Should the first dashboard be strictly read-only, or should it include start/continue actions in its first milestone?
3. Should controlled local commits be a future product goal, or should Shepherds-Staff permanently leave commits to the user?
4. Should the local API/dashboard command be named `ui`, `dashboard`, or `server`?
5. Should the product docs describe hosted/team modes as long-term possibilities, or exclude them entirely to keep the product local-only?
6. Should run metadata use a clean public schema even if it differs from current internal names, or should it mirror existing implementation names exactly?

## Decision review cadence

Review this file before starting any stage that affects:

- provider support
- dashboard/API execution controls
- run metadata schema
- artefact schema
- write safety
- commit automation
- release/distribution model
