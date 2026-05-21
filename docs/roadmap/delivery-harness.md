# Delivery Harness Implementation Plan

## Current repo review status

Last reviewed: 2026-05-21.

MergeWright is already positioned as an AI software delivery harness in the README and architecture docs. The repository also has more runtime surface than the original roadmap assumed:

- `run`, `continue-run`, run inspection, `report-run`, write-safety checks, Stage Plan commands, `tui`, and `tui-spike` are registered CLI commands.
- `report-run` already generates Change Report and optional PR summary artefacts from existing run artefacts.
- The reporting layer already computes a readiness-style status, score, risk level, reviewer verdict, checks state, write-safety state, post-write-review state, scope drift warnings, risk signals, manual review checklist, and suggested commit message.
- Reviewer output already has a strict fenced `json reviewer-verdict` parser with `PASS` or `FAIL`, blocking issues, and non-blocking issues.
- The TUI is no longer only aspirational. A read-only TUI command exists and can render a fixture or load real run data from the configured runs root.

The main missing foundation is still a canonical `evidence.json` manifest. Current reports and TUI read from existing artefacts such as `run.json`, write-audit summaries, `checks-status.json`, and reviewer output. That works, but it means evidence is still reconstructed after the fact rather than recorded through one typed evidence model.

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
  -> PR-ready summary
```

Core positioning:

```text
Coding agents write code.
Agent runtimes coordinate workers.
MergeWright proves whether the change is acceptable.
```

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

## Implemented baseline

### CLI and workflow baseline

Implemented:

- Classic run workflow: `run`, `continue-run`.
- Run inspection: `list-runs`, `show-run`, `open-run`.
- Change reporting: `report-run` with Markdown, JSON, and optional PR summary output.
- Project scaffolding: `init-project`.
- Safety: `check-write-safety`.
- Backend utility: `probe-opencode`.
- Stage Plan workflow: `import-stage-plan`, `run-stage`, `run-stages`, `continue-stages`, `accept-stage`, `fix-stage`, `reassess-stage-plan`.
- TUI surface: `tui`, `tui-spike`.

### Reporting baseline

Implemented:

- Change Report type with:
  - status
  - score
  - risk
  - changed files
  - untracked files
  - reviewer verdict
  - blocking and non-blocking reviewer issues
  - checks state
  - failed checks
  - write-safety state
  - post-write-review status
  - auto-chain summary when available
  - scope drift warnings
  - risk signals
  - manual review checklist
  - suggested commit message
- Report collector reconstructs evidence from existing artefacts.
- PR summary writer exists.

Gap:

- Reports do not yet consume a canonical evidence manifest.
- Missing evidence is partially inferred from absent artefacts, not represented through one typed model.

### Reviewer baseline

Implemented:

- Reviewer output parser requires exactly one fenced `json reviewer-verdict` block.
- Parser validates verdict, blocking issues, non-blocking issues, issue severity, summary, and files.
- `FAIL` requires at least one blocking issue.

Gap:

- Current reviewer schema does not yet include evidence checked, tests observed, acceptance criteria mapping, risk level, or recommended fix prompt.

### TUI baseline

Implemented:

- Read-only TUI command exists.
- TUI can use fixture mode or load run data from the configured runs root.
- TUI read model maps runs, phases, artefacts, safe actions, blocked reason, warnings, and reviewer findings.

Gap:

- TUI does not yet read `evidence.json` because the manifest does not exist.
- TUI does not yet show merge-readiness/prove output from a canonical evaluator.

## Revised milestone order

The old plan put TUI late. The repo now already has a TUI baseline, so the updated order is:

1. DH-1 Evidence manifest foundation
2. DH-2 Evidence backfill from existing artefacts
3. DH-3 Report integration with evidence manifest
4. DH-4 `prove` command using existing report/readiness logic first
5. DH-5 Stage contract schema
6. DH-6 Scope enforcement from contracts
7. DH-7 Acceptance criteria mapping
8. DH-8 Reviewer verdict v2
9. DH-9 Evidence-first reviewer prompt hardening
10. DH-10 TUI integration with evidence and prove result
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

Initial shape:

```ts
export type EvidenceManifest = {
  version: 1;
  runId: string;
  stageId?: string;
  projectName?: string | null;
  stageName?: string | null;
  status: 'in_progress' | 'needs_review' | 'needs_fix' | 'pass' | 'fail' | 'unknown';
  workspace: string | null;
  startedAt: string;
  completedAt?: string;
  git: {
    headBefore?: string;
    headAfter?: string;
    statusBefore?: string;
    statusAfter?: string;
    changedFiles: string[];
    untrackedFiles: string[];
    unexpectedFiles: string[];
  };
  commands: EvidenceCommand[];
  artefacts: EvidenceArtefact[];
  reviewer?: EvidenceReviewerSummary;
  checks?: EvidenceChecksSummary;
  writeSafety?: EvidenceWriteSafetySummary;
  postWriteReview?: EvidencePostWriteReviewSummary;
  stageContract?: EvidenceStageContract;
  readiness?: EvidenceReadinessSummary;
  risk?: EvidenceRiskSummary;
};
```

Acceptance:

- Manifest types and read/write/update helpers exist under `src/evidence/`.
- `evidence.json` is created for classic `run` dry-run and execution paths.
- `evidence.json` is created for Stage Plan stage runs where a run/stage artefact directory exists.
- Existing `run.json`, write-audit, checks, report, and TUI behaviour remains compatible.
- No orchestration, backend, safety, auto-chain, or commit behaviour changes.
- Tests cover create/read/update and missing file behaviour.

Builder prompt:

```text
Implement DH-1 Evidence Manifest Foundation for MergeWright.

Goal:
Add a canonical evidence manifest without changing orchestration behaviour.

Scope:
1. Add evidence manifest types under src/evidence/.
2. Add read/write/update helpers for evidence.json.
3. Create evidence.json for classic run dry-run and execution paths.
4. Create evidence.json for Stage Plan stage execution where a run/stage artefact directory exists.
5. Populate only baseline fields that are already available: runId, projectName, stageName, status, workspace, startedAt, completedAt when known, git defaults, commands empty array, artefacts empty or known artefacts.
6. Do not move report-run to evidence manifest yet.
7. Do not implement prove yet.
8. Do not change runner behaviour, safety gates, auto-chain behaviour, status semantics, or commit behaviour.

Acceptance:
- npm run build passes.
- npm test passes.
- New unit tests cover evidence manifest create/read/update helpers.
- Existing run tests assert evidence.json exists only where reliable.
- Existing reports and TUI still work.
```

Reviewer prompt:

```text
Review DH-1 Evidence Manifest Foundation.

Check:
1. evidence.json is additive and does not replace existing artefacts.
2. Manifest helpers are typed and tested.
3. Missing fields use explicit empty/default values where JSON consumers need stability.
4. Existing run, Stage Plan, report, TUI, safety, and auto-chain behaviour did not regress.
5. No backend execution behaviour changed.
6. npm run build and npm test pass.

Return PASS or FAIL with severity-ranked findings and minimal fix guidance.
```

## DH-2: Evidence backfill from existing artefacts

Goal: populate `evidence.json` from the artefacts MergeWright already writes.

Use existing sources:

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

Builder prompt:

```text
Implement DH-2 Evidence Backfill from Existing Artefacts.

Goal:
Populate evidence.json from artefacts that MergeWright already writes, without changing execution behaviour.

Scope:
1. Add evidence backfill/collector helpers under src/evidence/.
2. Reuse existing report collector logic where possible rather than duplicating parsing rules.
3. Populate git.changedFiles and git.untrackedFiles from write-audit summaries.
4. Populate reviewer summary from reviewer-output-last-message.md using the existing parser.
5. Populate checks summary from checks-status.json using existing semantics.
6. Represent malformed or missing artefacts explicitly.
7. Do not change report scoring yet.

Acceptance:
- npm run build passes.
- npm test passes.
- Evidence backfill tests cover complete artefacts, missing reviewer, malformed checks, malformed write audit.
- Current report-run output remains unchanged.
```

Reviewer prompt:

```text
Review DH-2 Evidence Backfill.

Check:
1. existing parsing semantics are preserved.
2. no report collector regression was introduced.
3. malformed artefacts are represented explicitly.
4. changed/untracked files match existing report behaviour.
5. tests cover missing and malformed artefacts.

Return PASS or FAIL.
```

## DH-3: Report integration with evidence manifest

Goal: make `report-run` prefer `evidence.json` when present, while preserving support for old runs.

Acceptance:

- `report-run` reads `evidence.json` when available.
- Old runs without `evidence.json` still use current collector path.
- Report output remains compatible.
- Missing evidence appears clearly where report content depends on it.

Builder prompt:

```text
Implement DH-3 Report Integration with Evidence Manifest.

Goal:
Make report-run consume evidence.json when available, with backwards compatibility for old runs.

Scope:
1. Add a report input adapter from EvidenceManifest to existing ChangeReport generation inputs.
2. Use evidence.json as the preferred source when present.
3. Fall back to current collectReportInputs behaviour when evidence.json is missing.
4. Preserve ChangeReport version 1 output shape unless a version bump is explicitly required.
5. Keep --json, --pr-summary, --stdout-only, and --force behaviours unchanged.

Acceptance:
- npm run build passes.
- npm test passes.
- report-run tests cover evidence-backed run and legacy run.
- PR summary remains compatible.
```

Reviewer prompt:

```text
Review DH-3 Report Integration.

Check:
1. legacy runs without evidence.json still work.
2. evidence-backed reports do not change public output accidentally.
3. missing evidence is visible and not overclaimed.
4. report-run flags and JSON-only behaviour are preserved.
5. tests cover legacy and evidence-backed paths.

Return PASS or FAIL.
```

## DH-4: `prove` command

Goal: expose a read-only merge-readiness decision using the existing Change Report scorer first, then migrate to a dedicated readiness evaluator later if needed.

Command:

```bash
npm run mergewright -- prove <run-id> --config configs/my-app.json
npm run mergewright -- prove <run-id> --config configs/my-app.json --json
```

Initial semantics:

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

Builder prompt:

```text
Implement DH-4 prove command.

Goal:
Expose MergeWright's merge-readiness decision as a read-only CLI command using the existing Change Report scoring path.

Scope:
1. Add `prove` to known commands, parser, help text, and command registry.
2. Usage: prove <run-id> --config <config-path> [--json]
3. Resolve run directory like report-run.
4. Prefer evidence.json when DH-3 exists; otherwise use existing generateChangeReport path.
5. Human output must include status, score, risk, reviewer verdict, checks state, risk signals or blockers, and suggested next action.
6. --json output must be JSON-only.
7. Exit 0 only for READY. Exit non-zero for NEEDS_REVIEW, NEEDS_FIX, BLOCKED, and errors.
8. Do not write report artefacts unless a future explicit flag is added.
9. Do not invoke AI, checks, git mutation, or workspace writes.

Acceptance:
- npm run build passes.
- npm test passes.
- CLI tests cover help, ready, fail, and --json.
- report-run behaviour is unchanged.
```

Reviewer prompt:

```text
Review DH-4 prove command.

Check:
1. prove is read-only.
2. exit codes match readiness status.
3. --json is clean JSON only.
4. human output is actionable but not noisy.
5. no report artefacts are written by default.
6. report-run behaviour is unchanged.

Return PASS or FAIL.
```

## DH-5: Stage contract schema

Goal: make Stage Plan stages enforceable.

Optional contract fields:

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

Acceptance:

- Forbidden changes block readiness.
- Out-of-scope changes warn by default.
- No-contract runs remain compatible.
- Tests cover exact paths, globs, nested paths, deleted files, and missing contract.

## DH-7: Acceptance criteria mapping

Goal: reviewer output must address each stage acceptance criterion.

Acceptance:

- Reviewer prompt includes structured acceptance criteria.
- Reviewer verdict includes pass/fail/unknown per criterion.
- `unknown` blocks readiness by default.
- Unstructured output cannot produce false PASS.

## DH-8: Reviewer verdict v2

Goal: extend the existing reviewer verdict schema without losing strict parsing.

Current schema:

```ts
export interface ReviewerDecision {
  verdict: 'PASS' | 'FAIL';
  blockingIssues: ReviewerIssue[];
  nonBlockingIssues: ReviewerIssue[];
}
```

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

## DH-10: TUI integration with evidence and prove result

Goal: upgrade the existing TUI to display evidence and readiness.

Acceptance:

- TUI reads evidence manifest when present.
- TUI falls back to current run read model when evidence is missing.
- TUI displays readiness status, score/risk, checks state, reviewer verdict, changed file count, and missing evidence warnings.
- TUI remains read-only.

## DH-11: Run comparison

Goal: compare two evidence-backed runs.

Command:

```bash
npm run mergewright -- compare-runs <run-id-a> <run-id-b> --config configs/my-app.json
```

Acceptance:

- Compare changed files, checks, reviewer verdict, readiness status, risk, and acceptance criteria.
- Supports `--json`.
- Read-only.
- Missing evidence is explicit.

## DH-12: Parallel focused reviews

Goal: add focused assurance reviews, not generic agent swarms.

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

## Current recommended next step

Start with DH-1, not TUI and not CAO.

The TUI already exists at a useful read-only baseline. The highest leverage next step is to create the canonical evidence manifest and then feed it into reports, `prove`, and the TUI.

Success looks like:

```bash
npm run mergewright -- prove <run-id> --config configs/my-app.json
```

And the command can answer:

- what changed?
- why did it change?
- was it in scope?
- what tests/checks ran?
- what failed?
- what was fixed?
- what evidence is missing?
- what is the risk?
- is this safe to merge?
