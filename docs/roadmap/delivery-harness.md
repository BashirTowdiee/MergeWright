# Delivery Harness Implementation Plan

## Current repo review status

Last reviewed: 2026-05-30.

MergeWright is positioned as a local-first AI software delivery harness. It owns the delivery path around agent-generated work: contracts, evidence, review gates, fix loops, reports, and merge-readiness decisions.

Implemented runtime surface includes:

- Classic run workflow: `run`, `continue-run`.
- Run inspection: `list-runs`, `show-run`, `open-run`.
- Change reporting: `report-run` with Markdown, JSON, and optional PR summary output.
- Readiness proof: `prove`.
- Run comparison: `compare-runs`.
- Review modes: focused assurance reviews.
- Project scaffolding: `init-project`.
- Safety: `check-write-safety`.
- Backend utility: `probe-opencode`.
- Stage Plan workflow: `import-stage-plan`, `run-stage`, `run-stages`, `continue-stages`, `accept-stage`, `fix-stage`, `reassess-stage-plan`.
- Legacy TUI commands: `tui`, `tui-spike`.

The web app is the intended primary human interface. It should run and supervise CLI-equivalent workflows through the Fastify API and shared application services. The CLI remains the scriptable automation surface. The TUI is superseded spike/client code and should not receive new product feature investment.

## Strategic direction

MergeWright should be steered as an AI software delivery harness, not a generic multi-agent runtime.

The product should answer one question better than adjacent tools:

> Can this AI-assisted change be trusted enough to merge?

This makes execution backends interchangeable. Codex, Claude Code, OpenCode, CAO, and future agents can all produce work. MergeWright owns the delivery path around that work: contracts, evidence, review gates, fix loops, reports, and merge-readiness decisions.

## Target product shape

Long-term flow:

```text
intent
  -> plan
  -> implementation
  -> self-review
  -> independent review
  -> fix loop
  -> checks
  -> diff audit
  -> change report
  -> prove/readiness result
  -> PR-ready summary
  -> team-visible review UI
```

Operator model:

```text
Web app -> Fastify API -> application service -> domain/use case -> adapters
CLI     -> application service -> domain/use case -> adapters
```

The web app should be the main operator cockpit for running CLI-equivalent workflows, inspecting artefacts, reviewing blockers, previewing safe actions, and showing team-visible review evidence.

## Design principles

1. **Evidence outranks summaries**
   - Reviewers and reports must prioritise git diff, test output, command output, changed files, and acceptance criteria before planner or builder summaries.

2. **Stages are contracts, not loose prompts**
   - A stage should define objective, scope, allowed paths, forbidden paths, required checks, expected artefacts, and acceptance criteria.

3. **No pass without proof**
   - A stage cannot become merge-ready unless required evidence exists and required checks have been observed.

4. **Human gates stay explicit**
   - Write mode, stage acceptance, and auto-commit remain explicit user actions.

5. **Execution backends are replaceable**
   - Provider-specific runners should remain behind executor contracts. The delivery model should not depend on one coding agent.

6. **Artefacts are the product**
   - Every run should leave a durable record of what changed, why, how it was reviewed, what failed, what was fixed, and what remains risky.

7. **Web is the primary human interface**
   - Humans should use the web app as the primary control room. The web app should expose CLI-equivalent workflows through API/application services, not by parsing CLI stdout or duplicating orchestration logic.

## Implemented baseline

### CLI and workflow baseline

Implemented:

- Classic run workflow: `run`, `continue-run`.
- Run inspection: `list-runs`, `show-run`, `open-run`.
- Change reporting: `report-run`.
- Readiness proof: `prove`.
- Run comparison: `compare-runs`.
- Focused review modes.
- Project scaffolding: `init-project`.
- Safety: `check-write-safety`.
- Backend utility: `probe-opencode`.
- Stage Plan workflow commands.

### Reporting baseline

Implemented:

- Change Report type with status, score, risk, changed files, reviewer verdict, checks state, write-safety state, scope drift warnings, risk signals, manual review checklist, and suggested commit message.
- Report collector reconstructs evidence from existing artefacts.
- Report generation can prefer `evidence.json` when present.
- PR summary writer exists.

### Reviewer baseline

Implemented:

- Reviewer output parser requires exactly one fenced `json reviewer-verdict` block.
- Parser validates verdict, blocking issues, non-blocking issues, issue severity, summary, and files.
- Reviewer verdict v2 supports evidence checked, tests observed, acceptance criteria mapping, risk level, and recommended fix prompt.
- `FAIL` requires at least one blocking issue.

### Legacy TUI baseline

Implemented:

- Read-only TUI command exists.
- TUI can use fixture mode or load run data from the configured runs root.
- TUI read model maps runs, phases, artefacts, safe actions, blocked reason, warnings, reviewer findings, and readiness data.

Status:

- Superseded as a product path.
- Keep compiling while reusable read-model, command, event, and safety abstractions are extracted.
- Do not add new TUI product features.
- Remove or quarantine `src/tui/**` after the web app has useful run-inspection parity.

## Revised milestone order

Progress note as of 2026-05-30: DH-1 through DH-12 are implemented. DH-13 is the active next slice.

1. DH-1 Evidence manifest foundation
2. DH-2 Evidence backfill from existing artefacts
3. DH-3 Report integration with evidence manifest
4. DH-4 `prove` command using existing report/readiness logic first
5. DH-5 Stage contract schema
6. DH-6 Scope enforcement from contracts
7. DH-7 Acceptance criteria mapping
8. DH-8 Reviewer verdict v2
9. DH-9 Evidence-first reviewer prompt hardening
10. DH-10 Web/API readiness surface using evidence and prove results
11. DH-11 Run comparison
12. DH-12 Parallel focused reviews
13. DH-13 Runner contract hardening
14. DH-14 Optional CAO backend

## DH-1: Evidence manifest foundation

Goal: add the canonical evidence model without changing behaviour.

Target file:

```text
.artifacts/runs/<run-id>/evidence.json
```

Status: implemented.

Acceptance:

- Manifest types and read/write/update helpers exist under `src/evidence/`.
- `evidence.json` is created for classic `run` dry-run and execution paths.
- `evidence.json` is created for Stage Plan stage runs where a run/stage artefact directory exists.
- Existing `run.json`, write-audit, checks, report, and legacy TUI behaviour remains compatible.
- No orchestration, backend, safety, auto-chain, or commit behaviour changes.
- Tests cover create/read/update and missing file behaviour.

## DH-2: Evidence backfill from existing artefacts

Goal: populate `evidence.json` from artefacts that MergeWright already writes.

Status: implemented.

Sources:

- `run.json`
- `01-stage-input.md`
- `write-audit/builder/summary.json`
- `write-audit/fix/summary.json`
- `checks-status.json`
- `reviewer-output-last-message.md`
- generated reports, where present

Acceptance:

- Evidence backfill reads existing artefacts and updates manifest deterministically.
- Changed files and untracked files match current report collector behaviour.
- Reviewer summary uses existing reviewer parser.
- Checks summary matches current checks parsing behaviour.
- Malformed artefacts are represented as missing or malformed evidence, not ignored.

## DH-3: Report integration with evidence manifest

Goal: make `report-run` prefer `evidence.json` when present, while preserving support for old runs.

Status: implemented.

Acceptance:

- `report-run` reads `evidence.json` when available.
- Old runs without `evidence.json` still use the legacy collector path.
- Report output remains compatible.
- Missing evidence appears clearly where report content depends on it.

## DH-4: `prove` command

Goal: expose a read-only merge-readiness decision.

Status: implemented.

Command:

```bash
npm run mergewright -- prove <run-id> --config .artifacts/projects/my-app/config.json
npm run mergewright -- prove <run-id> --config .artifacts/projects/my-app/config.json --json
```

Semantics:

- Generate or compute the same readiness basis as `report-run`.
- `READY` exits 0.
- `NEEDS_REVIEW`, `NEEDS_FIX`, and `BLOCKED` exit non-zero.
- `--json` prints JSON-only output.
- The command is read-only and does not invoke AI, checks, git mutation, or workspace writes.

Acceptance:

- `prove` command is registered and documented.
- Human output shows status, score, risk, blockers/risk signals, checks state, reviewer verdict, and suggested next action.
- JSON output is machine-readable and has no progress noise.
- Tests cover READY and non-ready cases.

## DH-5: Stage contract schema

Goal: make Stage Plan stages enforceable.

Status: implemented.

Optional contract fields include:

```yaml
allowedPaths:
  - src/**
  - test/**
forbiddenPaths:
  - package-lock.json
requiredCommands:
  - npm run build
  - npm test
requiredEvidence:
  - git.diff
  - checks.unit
acceptanceCriteria:
  - CLI help shows mergewright.
review:
  checklist:
    - verify command examples
```

Acceptance:

- Existing Stage Plans remain valid.
- Optional contract fields validate strictly when present.
- Contract summary renders into Stage Plan Markdown.
- Active contract is stored in evidence manifest during stage execution.

## DH-6: Scope enforcement from contracts

Goal: classify changed files using contract `allowedPaths` and `forbiddenPaths`.

Status: implemented.

Acceptance:

- Forbidden changes block readiness.
- Out-of-scope changes warn by default.
- No-contract runs remain compatible.
- Tests cover exact paths, globs, nested paths, deleted files, and missing contract.

## DH-7: Acceptance criteria mapping

Goal: reviewer output must address each stage acceptance criterion.

Status: implemented.

Acceptance:

- Reviewer prompt includes structured acceptance criteria.
- Reviewer verdict includes pass/fail/unknown per criterion.
- `unknown` blocks readiness by default.
- Unstructured output cannot produce false PASS.

## DH-8: Reviewer verdict v2

Goal: extend the existing reviewer verdict schema without losing strict parsing.

Status: implemented.

Target additions:

```ts
evidenceChecked: EvidenceCheck[];
acceptanceCriteria: AcceptanceCriteriaResult[];
testsObserved: TestObservation[];
riskLevel: 'low' | 'medium' | 'high';
recommendedFixPrompt?: string;
```

Acceptance:

- Existing strict parser remains strict.
- Migration path handles old reviewer verdict shape for old artefacts.
- New reviewer prompt requests v2 fields.
- Invalid output fails safely.

## DH-9: Evidence-first reviewer prompt hardening

Goal: make concrete evidence appear before planner/builder summaries.

Status: implemented.

Required order:

1. git diff
2. test/check output
3. changed files
4. stage contract and acceptance criteria
5. implementation notes
6. planner/builder summaries

Acceptance:

- Snapshot tests prove ordering.
- No reviewer template places summaries before evidence.
- No reviewer context is accidentally removed.

## DH-10: Web/API readiness surface using evidence and prove results

Goal: expose evidence and readiness through the API/web path so the web app can become the main human interface for CLI-equivalent workflows.

Status: partially implemented through API and web client foundations.

Acceptance:

- Fastify routes expose run list, run detail, artefacts, and command submission through application services.
- Web client consumes API schemas for run list, run detail, artefacts, and commands.
- Web view models use generic read models, not TUI-owned types.
- Web/API surfaces do not parse CLI stdout.
- Web/API surfaces do not duplicate orchestration logic.
- Legacy TUI readiness views remain compatibility-only and are not the active product path.

## DH-11: Run comparison

Goal: compare two evidence-backed runs.

Status: implemented.

Command:

```bash
npm run mergewright -- compare-runs <run-id-a> <run-id-b> --config .artifacts/projects/my-app/config.json
```

Acceptance:

- Compare changed files, checks, reviewer verdict, readiness status, risk, and acceptance criteria.
- Supports `--json`.
- Read-only.
- Missing evidence is explicit.

## DH-12: Parallel focused reviews

Goal: add focused assurance reviews, not generic agent swarms.

Status: implemented.

Modes:

- architecture
- tests
- regression
- security
- docs
- maintainability

Acceptance:

- Each mode has a focused checklist.
- Each mode emits reviewer verdict v2.
- Aggregate verdict fails if any mode fails.
- No write execution.

## DH-13: Runner contract hardening

Goal: keep execution backends replaceable.

Status: active next slice.

Runner responsibilities only:

- execute prompt
- capture stdout/stderr
- return exit status
- declare capabilities
- declare write support

Runner must not own:

- stage acceptance
- evidence evaluation
- reports
- merge-readiness decisions

Acceptance:

- Codex execution still works.
- OpenCode probe remains isolated.
- Backend-specific metadata is namespaced.
- Capability model is explicit.

## DH-14: Optional CAO backend

Goal: use CAO as optional infrastructure, not as the product centre.

Status: future.

Acceptance:

- CAO output is normalised into MergeWright artefacts.
- MergeWright still owns review gates and readiness.
- CAO unavailable failure is deterministic.
- Feature is optional.
- Default Codex/backend flows are unchanged.

## Non-goals

- Do not chase generic agent swarm features before evidence and contracts are strong.
- Do not make CAO, Codex, Claude Code, or OpenCode the centre of the architecture.
- Do not auto-merge or auto-accept changes without explicit human policy.
- Do not treat loose reviewer prose as proof.
- Do not hide missing checks or missing evidence in reports.
- Do not revive the TUI as the primary human interface.
- Do not make the web app parse CLI stdout as product state.

## Current recommended next step

Start with DH-13 runner contract hardening.

The evidence-first flow now covers manifest, report, prove, run comparison, and focused mode reviews. The next leverage point is hardening backend runner contracts so orchestration policy remains backend-agnostic while the API/web path becomes the main human control surface.

Success looks like:

```bash
npm run mergewright -- probe-opencode --config .artifacts/projects/my-app/config.json --validate-readonly-contract
```

And the command can answer:

- are runner capabilities explicit and validated?
- is backend metadata namespaced and isolated?
- do delivery decisions stay out of execution backends?
- does backend substitution remain deterministic and safe?
