# Delivery Harness Implementation Plan

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

## Implementation tracks

### Track 1: Trust engine

Goal: make each run produce a structured merge-readiness decision.

#### 1.1 Run evidence manifest

Add a canonical machine-readable manifest for every run and stage.

Suggested file:

```text
.artifacts/runs/<run-id>/evidence.json
```

Suggested shape:

```ts
export type EvidenceManifest = {
  runId: string;
  stageId?: string;
  status: 'in_progress' | 'needs_review' | 'needs_fix' | 'pass' | 'fail';
  workspace: string;
  startedAt: string;
  completedAt?: string;
  git: {
    headBefore?: string;
    headAfter?: string;
    statusBefore?: string;
    statusAfter?: string;
    changedFiles: string[];
    unexpectedFiles: string[];
  };
  commands: EvidenceCommand[];
  artefacts: EvidenceArtefact[];
  review?: ReviewVerdict;
  acceptance?: AcceptanceEvaluation;
  risk?: RiskSummary;
};
```

Acceptance bar:

- manifest is written for dry-run and execution paths
- manifest is updated incrementally after each phase
- report generation can read from the manifest instead of scraping loose files only
- tests cover partial, failed, and successful runs

#### 1.2 Evidence collector

Centralise collection for:

- git status before and after write phases
- changed file list
- diff path
- command outputs
- test/check outputs
- reviewer output
- fix output
- report output

Acceptance bar:

- all write-enabled paths record before/after git state
- all check commands record command, exit code, stdout/stderr artefact path, and timestamp
- missing evidence is represented explicitly, not silently ignored

#### 1.3 Merge-readiness evaluator

Add a deterministic evaluator that produces a pass/fail decision from evidence.

Suggested command later:

```bash
npm run agent -- prove <run-id> --config configs/my-app.json
```

Initial implementation can be internal and used by `report-run`.

Evaluation rules:

- fail if required checks were configured but not run
- fail if required checks failed
- fail if reviewer verdict failed
- fail if expected changed files are missing
- fail if forbidden paths changed
- fail if write-safety metadata is missing for write-enabled runs
- warn if diff exists but no review artefact exists

Acceptance bar:

- deterministic result independent of agent wording
- JSON and Markdown output
- unit tests for each failure reason

### Track 2: Stage contract system

Goal: make stage scope and acceptance criteria enforceable.

#### 2.1 Contract schema

Extend Stage Plans or add a stage contract layer with fields like:

```yaml
id: provider-switching-09
objective: Add backend command override support
allowedPaths:
  - src/**
  - test/**
  - docs/**
forbiddenPaths:
  - package-lock.json
requiredCommands:
  - npm run build
  - npm test
acceptanceCriteria:
  - --command overrides backend config command
  - unsupported backend fails deterministically
requiredEvidence:
  - git.diff
  - checks.unit
  - checks.build
review:
  checklist:
    - verify CLI precedence rules
    - verify deterministic failure paths
    - verify docs match behaviour
```

Acceptance bar:

- schema validates unknown fields and invalid glob patterns
- stage import renders contract summary into Markdown
- runner stores the active contract in run artefacts

#### 2.2 Scope enforcement

Use `allowedPaths` and `forbiddenPaths` to classify changed files after write phases.

Acceptance bar:

- forbidden path changes fail merge-readiness
- out-of-scope path changes are reported as warnings or failures based on config
- tests cover exact paths, glob paths, nested paths, and deleted files

#### 2.3 Acceptance criteria mapping

Require reviewer output to explicitly address each criterion.

Acceptance bar:

- reviewer prompt receives the criteria in a structured section
- reviewer verdict includes per-criterion pass/fail/unknown
- `unknown` blocks merge-readiness unless explicitly configured otherwise

### Track 3: Deterministic reviewer

Goal: make review output structured enough to drive fix loops and reports.

#### 3.1 Review verdict schema

Add a formal schema:

```ts
export type ReviewVerdict = {
  verdict: 'PASS' | 'FAIL';
  findings: ReviewFinding[];
  evidenceChecked: EvidenceCheck[];
  acceptanceCriteria: AcceptanceCriteriaResult[];
  testsObserved: TestObservation[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendedFixPrompt?: string;
};
```

Acceptance bar:

- schema validates reviewer output where possible
- invalid structured output degrades to a controlled failure or fallback parser
- fix prompt generation uses findings, not loose prose

#### 3.2 Evidence-first prompt order

Reviewer prompts should inspect evidence in this order:

1. git diff
2. test/check output
3. changed files
4. stage contract and acceptance criteria
5. implementation notes
6. planner/builder summaries

Acceptance bar:

- prompt templates reflect this order
- tests snapshot the generated reviewer prompt
- no reviewer template puts agent summaries before core evidence

#### 3.3 Review modes

Add explicit review modes after the core schema is stable:

```bash
npm run agent -- review-run <run-id> --mode architecture
npm run agent -- review-run <run-id> --mode tests
npm run agent -- review-run <run-id> --mode regression
npm run agent -- review-run <run-id> --mode security
```

Acceptance bar:

- each mode has a focused checklist
- all modes emit the same `ReviewVerdict` schema
- aggregate review can produce one final verdict

### Track 4: Change report and PR readiness

Goal: make reports useful enough to paste into PRs or hand to a human reviewer.

#### 4.1 Report sections

AI Change Reports should include:

- intent
- stage contract summary
- changed files
- diff summary
- commands run
- checks passed/failed/skipped
- reviewer verdict
- fix-loop history
- risk summary
- merge-readiness decision
- PR summary

Acceptance bar:

- report can be generated from an evidence manifest
- missing evidence appears as `Missing`, not omitted
- PR summary is concise and separated from the full audit report

#### 4.2 `prove` command

Introduce a command that produces a merge-readiness result without rerunning agents.

```bash
npm run agent -- prove <run-id> --config configs/my-app.json
```

Output example:

```text
Merge readiness: FAIL

Blocking:
1. Required check `npm test` was not observed.
2. Reviewer verdict is FAIL.
3. Forbidden path changed: package-lock.json.

Suggested next action:
Run fixer with the generated fix prompt.
```

Acceptance bar:

- works for classic runs and Stage Plan stages
- exits non-zero on fail
- supports `--json`
- does not mutate workspace

#### 4.3 PR body generation

Strengthen `report-run --pr-summary` into a stable PR body generator.

Acceptance bar:

- includes test evidence
- includes risk summary
- includes reviewer verdict
- includes known limitations
- does not overclaim if evidence is missing

### Track 5: Control plane

Goal: make the evidence model visible and usable while runs are in progress.

#### 5.1 TUI-first cockpit

Build a terminal UI before a browser UI.

Target view:

```text
Stage: provider-switching-09

[✓] preflight
[✓] planner
[✓] builder
[✗] reviewer
[ ] fixer
[ ] final-review
[ ] report

Reviewer findings:
HIGH  --command precedence not tested
MED   unsupported backend handling incomplete

Evidence:
- Diff: 8 files
- Tests: npm test failed
- Git: clean before run, dirty after builder
```

Acceptance bar:

- TUI reads run metadata and evidence manifest
- non-TUI command output remains stable
- no orchestration logic is embedded in the UI layer

#### 5.2 Run comparison

Add tooling to compare two runs of the same stage.

Acceptance bar:

- shows changed files difference
- shows check result differences
- shows reviewer verdict differences
- helps detect drift between agent attempts

### Track 6: Backend expansion without product drift

Goal: integrate more execution backends while keeping MergeWright's trust model central.

#### 6.1 Runner contract hardening

Keep runner responsibilities narrow:

- execute prompt
- capture stdout/stderr
- return exit status
- declare capabilities
- declare write support

The runner should not own stage acceptance, evidence evaluation, or reports.

Acceptance bar:

- Codex runner still works
- OpenCode probe remains isolated
- backend-specific metadata is stored under a namespaced field

#### 6.2 CAO as an optional backend

If CAO support is added, treat it as a worker runtime, not as MergeWright's product centre.

Conceptual config:

```yaml
backend:
  type: cao
  supervisorProfile: shepherd-supervisor
  workerProfiles:
    builder: codex-builder
    reviewer: claude-reviewer
```

Acceptance bar:

- CAO output is normalised into MergeWright artefacts
- MergeWright still owns review gates and merge-readiness decisions
- failure modes are deterministic when CAO is unavailable

## Suggested milestone order

### Milestone DH-1: Evidence manifest foundation

Deliver:

- `EvidenceManifest` types
- evidence writer/reader
- run/stage manifest creation
- command evidence capture
- report-run reads manifest when available

Why first: all later trust features need a canonical evidence source.

### Milestone DH-2: Merge-readiness evaluator

Deliver:

- deterministic evaluator
- Markdown and JSON output
- integration into `report-run`
- initial `prove` command

Why second: this creates the differentiated product surface.

### Milestone DH-3: Stage contracts

Deliver:

- contract schema
- required commands
- required evidence
- allowed/forbidden path classification
- contract rendering in Stage Plan Markdown

Why third: this makes stages enforceable rather than descriptive.

### Milestone DH-4: Structured reviewer verdict

Deliver:

- review verdict schema
- reviewer prompt updates
- fallback parser or controlled failure for invalid output
- fix prompt generation from findings

Why fourth: structured review becomes useful once evidence and contracts exist.

### Milestone DH-5: Stronger reports and PR summaries

Deliver:

- report sections from manifest
- missing evidence reporting
- PR body generator
- risk summary

Why fifth: reports become more valuable after evidence, contracts, and review are structured.

### Milestone DH-6: TUI cockpit

Deliver:

- read-only run dashboard
- phase status
- evidence status
- review findings
- merge-readiness status

Why sixth: the UI should visualise a stable model, not invent one.

### Milestone DH-7: Parallel focused reviews

Deliver:

- review modes
- aggregate verdict
- architecture/tests/security/regression review specialisations

Why seventh: parallelism should improve assurance, not become generic agent swarm behaviour.

### Milestone DH-8: Optional CAO/backend integration

Deliver:

- backend capability model extensions
- optional CAO runner adapter
- normalised artefact capture

Why last: runtime breadth should not come before the delivery harness is strong.

## Non-goals

- Do not chase generic agent swarm features before evidence and contracts are strong.
- Do not make CAO, Codex, Claude Code, or OpenCode the centre of the architecture.
- Do not auto-merge or auto-accept changes without explicit human policy.
- Do not treat reviewer prose as proof unless it maps to structured evidence.
- Do not hide missing checks or missing evidence in reports.

## Success criteria

MergeWright is ahead of generic agent orchestrators when a user can run one command and answer:

- what changed?
- why did it change?
- was it in scope?
- what tests/checks ran?
- what failed?
- what was fixed?
- what evidence is missing?
- what is the risk?
- is this safe to merge?

The product wins when the final output is not just generated code. The output is a defensible delivery decision.
