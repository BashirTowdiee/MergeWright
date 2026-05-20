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
MergeWright should be positioned as a local-first, terminal-native agentic workflow orchestrator for safe, staged, auditable AI-assisted software development.
```

Rationale:

This keeps the product broader than a Codex wrapper while still focused on software engineering workflows.

Implications:

- CLI remains a product surface, not the whole product identity.
- TUI becomes the primary human product surface.
- Future API/dashboard/editor surfaces should reuse the same orchestration model.
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
- TUI should reuse shared application services rather than shelling out and parsing CLI text.
- CLI remains useful even after the TUI becomes the main human interface.

### D003: TUI is the primary human interface

Status: Accepted

Decision:

```txt
The TUI is the chosen primary human interface for MergeWright.
```

Rationale:

MergeWright is local-first, repo-aware, terminal-native, and developer-oriented. A TUI better fits the product identity than a SaaS-style web dashboard. It keeps users in the same environment where they run commands, inspect git state, review logs, and supervise agent workflows.

Implications:

- Roadmap should prioritise run metadata, artefact index, application services, and TUI implementation.
- Web dashboard work is deferred and optional.
- TUI design should focus on run inspection, phase flow, artefact preview, review findings, safety gates, and safe next actions.
- TUI framework choice becomes a product architecture decision.

### D004: Local-first before hosted

Status: Accepted

Decision:

```txt
MergeWright should remain local-first for the current product horizon.
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

- `run.json`, `artefacts.json`, and `events.jsonl` should be stabilised before the TUI becomes control-capable.
- SQLite should not be required for the first read-only TUI unless filesystem scanning is too slow.

### D006: Provider-agnostic direction

Status: Open

Decision needed:

```txt
Should MergeWright formally commit to a provider-agnostic execution contract, with Codex as the first provider?
```

Default recommendation:

Yes, but only after the run state and artefact contracts are stable.

Implications if accepted:

- Add provider interface and capability matrix.
- Isolate Codex-specific flags and output parsing.
- Record provider/model metadata in run state.
- Surface provider/model metadata in the TUI.

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
- Add explicit TUI confirmation and review state.

### D008: Local API command name

Status: Deferred

Decision needed:

```txt
Should the local API/dashboard be launched through `ui`, `server`, `dashboard`, or another command?
```

Default recommendation:

Defer. The local API is no longer the next primary interface. Revisit only if an API/web/editor surface becomes necessary.

### D009: Dashboard timeline implementation

Status: Deferred

Decision needed:

```txt
Should the first dashboard use React Flow or simple ordered phase cards?
```

Default recommendation:

Defer. The dashboard is optional and later than the TUI.

### D010: TUI framework choice

Status: Open

Decision needed:

```txt
Should the central TUI use Ink, OpenTUI/Solid, or another framework?
```

Default recommendation:

Spike Ink and OpenTUI/Solid with the same realistic screen before choosing. Include pane focus, phase flow, artefact preview, scrollable logs, keyboard shortcuts, and terminal resize in the spike.

Implications if Ink is chosen:

- Faster MVP.
- Lower ecosystem risk.
- Potentially easier to outgrow if the TUI becomes a complex full-screen app.

Implications if OpenTUI/Solid is chosen:

- Better alignment with a serious full-screen terminal app direction.
- Closer to OpenCode-style architecture.
- Higher ecosystem risk and more source-code reading.

## Open questions requiring maintainer input

1. Should provider-agnostic execution be a committed product direction, or should the product stay Codex-specific for now?
2. Should controlled local commits be a future product goal, or should MergeWright permanently leave commits to the user?
3. Should the central TUI use Ink, OpenTUI/Solid, or another framework?
4. Should hosted/team modes be excluded entirely to keep the product local-only?
5. Should run metadata use a clean public schema even if it differs from current internal names, or should it mirror existing implementation names exactly?

## Decision review cadence

Review this file before starting any stage that affects:

- TUI framework selection
- provider support
- run metadata schema
- artefact schema
- write safety
- commit automation
- optional API/web/editor surfaces
- release/distribution model
