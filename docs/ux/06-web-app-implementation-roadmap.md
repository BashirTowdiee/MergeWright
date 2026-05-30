# Web App Implementation Roadmap

## Status

Proposed implementation roadmap for turning the web demo and information architecture into the real MergeWright web app.

This roadmap assumes:

- Web is the primary human interface.
- CLI remains the automation and scripting surface.
- API is the orchestration boundary for web clients.
- TUI is superseded.

## Current foundation

Already available or partially available:

- `apps/web` package boundary.
- `apps/api` package boundary.
- Fastify API with health, runs, run detail, artefact list, artefact detail, and command submission routes.
- Web API client for runs, artefacts, and commands.
- Run list/detail view-model mapping.
- CLI commands for run, continue-run, report-run, prove, compare-runs, review-modes, Stage Plan commands, write-safety, and provider probing.
- Static demo at `docs/ux/web-app-demo.html`.
- Information architecture at `docs/ux/05-web-app-information-architecture.md`.

## Implementation principles

- Build page slices around user workflows, not around data models alone.
- Keep orchestration outside React components.
- Use typed API calls and schema-validated payloads.
- Preserve local-first operation.
- Keep CLI-equivalent command previews visible for trust and debugging.
- Prefer useful read-only views before write-enabled actions.
- Add write actions behind explicit confirmation gates.

## Phase 1: Web shell and navigation

Goal: create the real app shell with stable navigation.

Scope:

- Add Next.js app structure under `apps/web`.
- Add layout with persistent side navigation and sticky topbar.
- Add route placeholders for:
  - `/projects`
  - `/runs`
  - `/runs/[runId]`
  - `/results/[runId]`
  - `/review/[runId]`
  - `/commands`
  - `/settings`
- Add route metadata and breadcrumbs.
- Add shared UI primitives for cards, tables, pills, metrics, toolbar, and empty states.

Acceptance:

- App builds.
- Navigation works.
- Pages render placeholder content without API dependency.
- UI language matches MergeWright terms: run, stage, phase, artefact, safety gate, approval gate, safe next action.

## Phase 2: Projects and project health

Goal: make the web app project-aware.

Scope:

- Define project read model.
- Add project list and selected project state.
- Surface config path, runs root, workspace root, default provider, and health status.
- Add project health endpoint if required.

Potential API additions:

```text
GET /projects
GET /projects/:projectId
GET /projects/:projectId/health
```

Acceptance:

- User can select a project.
- Selected project drives runs query context.
- Project health shows config availability and runs root availability.

## Phase 3: Runs list

Goal: replace file/terminal inspection with a useful run queue.

Scope:

- Connect `/runs` page to `GET /runs`.
- Add status filters.
- Add run search.
- Add columns for status, mode, branch, started, duration, score, reviewer verdict, checks state, and safe next action.
- Add empty, loading, and error states.

Potential API additions:

```text
GET /runs?projectId=<id>&status=<status>&q=<query>
```

Acceptance:

- Runs page shows real run data.
- Filtering works.
- Clicking a run navigates to run detail.

## Phase 4: Run detail

Goal: make a single run understandable.

Scope:

- Connect `/runs/[runId]` to `GET /runs/:runId`.
- Render run goal, branch, mode, workspace, provider, model, warnings, and blocked reason.
- Render phase timeline.
- Render safe next actions.
- Render reviewer findings.
- Render artefact list preview.

Acceptance:

- User can answer what happened in a run.
- User can identify why the run is blocked.
- User can see what action is safe next.

## Phase 5: Artefacts

Goal: make generated outputs inspectable from the browser.

Scope:

- Connect artefact list to `GET /runs/:runId/artifacts`.
- Add artefact detail view.
- Render Markdown, JSON, log, diff, and plain text artefacts.
- Add copy path and open locally affordances.

Potential API additions:

```text
GET /runs/:runId/artifacts/:artifactId/content
```

Acceptance:

- User can inspect `evidence.json`, `run-report.md`, `pr-summary.md`, checks, reviewer output, and write-audit summaries.
- Missing artefacts display clear errors.

## Phase 6: Results and prove view

Goal: turn readiness proof into a first-class UI.

Scope:

- Add `/results/[runId]` page.
- Render readiness status, score, risk, reviewer verdict, checks state, acceptance criteria, blockers, warnings, and next action.
- Add run prove command action.
- Add report generation action.

Potential API additions:

```text
GET /runs/:runId/readiness
POST /commands { type: "prove" }
POST /commands { type: "generate-report" }
```

Acceptance:

- User can see whether a run is ready.
- User can see why it is not ready.
- User can run prove without writing artefacts.

## Phase 7: Command builder

Goal: make the web app the main interface for CLI-equivalent workflows.

Scope:

- Build command template selector.
- Add forms for run, continue-run, prove, report-run, compare-runs, review-modes, fix-stage, accept-stage, check-write-safety, and probe-opencode.
- Add equivalent CLI command preview.
- Add typed command payload preview.
- Add risk preview and confirmation gate.
- Submit command through `POST /commands`.
- Show typed result, human summary, and CLI-style output.

Potential API additions:

```text
POST /commands/preview
POST /commands
GET /commands/:commandId/events
```

Acceptance:

- User can preview commands before execution.
- Write-enabled commands require explicit confirmation.
- Command results are typed and visible.
- Web UI does not parse CLI stdout as product state.

## Phase 8: Review details

Goal: make reviewer output actionable.

Scope:

- Add `/review/[runId]` page.
- Render blocking and non-blocking issues.
- Render severity and affected files.
- Render evidence checked and tests observed.
- Render acceptance criteria mapping.
- Render recommended fix prompt.
- Add focused review modes UI.

Potential API additions:

```text
GET /runs/:runId/review
POST /commands { type: "review-modes" }
```

Acceptance:

- User can distinguish blockers from warnings.
- User can copy recommended fix prompt.
- User can run focused reviews.

## Phase 9: Stage Plans

Goal: make staged delivery usable from the web.

Scope:

- Add stage plan list and detail pages.
- Render stage contracts, allowed paths, forbidden paths, required checks, required evidence, and acceptance criteria.
- Add actions for import, run stage, continue stages, fix stage, accept stage, and reassess downstream stages.

Potential API additions:

```text
GET /stage-plans
GET /stage-plans/:stagePlanId
POST /commands { type: "run-stage" }
POST /commands { type: "fix-stage" }
POST /commands { type: "accept-stage" }
POST /commands { type: "reassess-stage-plan" }
```

Acceptance:

- User can see stage status and contracts.
- User can run or fix one stage at a time.
- User can accept stages explicitly.

## Phase 10: Evidence matrix

Goal: show the proof behind readiness decisions.

Scope:

- Add evidence page.
- Render required versus optional evidence.
- Render present, missing, malformed, failed, or stale status.
- Link each evidence item to source artefact.
- Explain blocking impact.

Potential API additions:

```text
GET /runs/:runId/evidence
```

Acceptance:

- User can see exactly which evidence is missing or failed.
- User can open evidence source artefacts.

## Phase 11: Compare runs

Goal: make fix-loop improvement visible.

Scope:

- Add compare runs page.
- Select run A and run B.
- Render score, risk, reviewer, checks, changed files, acceptance, and missing evidence deltas.
- Link to both run details.

Potential API additions:

```text
GET /runs/compare?runA=<id>&runB=<id>
POST /commands { type: "compare-runs" }
```

Acceptance:

- User can see whether a fix improved or regressed readiness.
- Missing evidence warnings are visible for both runs.

## Phase 12: Providers

Goal: make backend runner capability visible.

Scope:

- Add providers page.
- Render configured providers, status, version, capabilities, read-only support, write support, and last probe.
- Add provider probe action.

Potential API additions:

```text
GET /providers
POST /commands { type: "probe-opencode" }
```

Acceptance:

- User can see which providers are available.
- User can probe providers without running agent prompts.

## Phase 13: Policy & Safety

Goal: make write-safety and policy rules visible before execution.

Scope:

- Add policy and safety page.
- Render write-safety status, dirty worktree state, allowed paths, forbidden paths, required checks, required evidence, confirmation rules, and audit history.
- Add write-safety check action.
- Add command risk preview.

Potential API additions:

```text
GET /policy
GET /safety/write-status
POST /commands { type: "check-write-safety" }
```

Acceptance:

- User can understand why a command is safe or blocked.
- Write-enabled commands are never hidden behind ambiguous UI.

## Phase 14: Team Review

Goal: prepare the local-first UI for team-visible review.

Scope:

- Add approval queue.
- Add review comments.
- Add PR summary preview.
- Add audit trail.
- Add mark-reviewed and request-changes flows.

Potential API additions:

```text
GET /reviews
POST /reviews/:id/comments
POST /reviews/:id/approval
```

Acceptance:

- Reviewers can understand blocked states quickly.
- Approval history is auditable.

## Phase 15: Settings

Goal: make local project behaviour configurable.

Scope:

- Add settings page.
- Configure default config, runs root, default provider, default model, retention, and UI preferences.
- Add keyboard shortcuts reference.

Acceptance:

- User can understand and modify local defaults.
- Settings do not bypass safety or policy gates.

## API gap summary

Current API covers:

```text
GET /health
GET /runs
GET /runs/:runId
GET /runs/:runId/artifacts
GET /runs/:runId/artifacts/:artifactId
POST /commands
```

Likely next API additions:

```text
GET /projects
GET /projects/:projectId/health
GET /runs/:runId/artifacts/:artifactId/content
GET /runs/:runId/readiness
GET /runs/:runId/review
GET /runs/:runId/evidence
GET /runs/:runId/events
POST /commands/preview
GET /commands/:commandId/events
GET /stage-plans
GET /stage-plans/:stagePlanId
GET /providers
GET /policy
GET /safety/write-status
```

## UI risk controls

Before executing a write-enabled command, the UI must show:

- command type
- equivalent CLI command
- typed command payload
- risk level
- expected affected files
- whether workspace writes are possible
- whether artefacts will be written
- whether git state may change
- whether confirmation is required
- cancellation/rollback limitations

## Success criteria

The web app is successful when a user can:

- choose a project
- inspect runs
- open a blocked run
- understand why it is blocked
- inspect reviewer findings and evidence
- preview a safe next command
- approve or reject that command
- inspect resulting artefacts
- run prove and understand readiness
- prepare a PR-ready summary

without opening terminal logs or manually digging through run directories.
