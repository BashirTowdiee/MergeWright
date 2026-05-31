# Web Interface Implementation Plan

## Status

Accepted implementation direction.

The web app is the primary human interface for MergeWright. The CLI remains the automation and scripting surface. The TUI path is superseded.

## Purpose

This document defines the implementation plan for the MergeWright web interface.

The design reference for this implementation is `docs/ux/web-app-demo.html`. When implementation choices are ambiguous, prefer the demo's interaction model and terminology unless it conflicts with architecture boundaries in this document.

The web interface should be a local-first operator control room for safe, staged, auditable AI coding workflows. It should not be a thin visual wrapper over the CLI, a generic admin dashboard, or a chat-first app.

## Product concept

```txt
MergeWright Web:
A local control room for supervising agent runs, inspecting evidence, reviewing blockers, and executing safe next actions.

CLI = automation and scripting surface
Web = primary human control room
API = orchestration boundary for UI clients
```

The web app should immediately answer:

- What repository or workspace am I supervising?
- What runs exist?
- What is currently running, blocked, failed, or ready?
- What was the run trying to do?
- Which phase passed, failed, or is blocked?
- What artefacts were produced?
- What did the reviewer find?
- What changed?
- What action is safe next?
- What needs explicit approval?
- Is the PR merge-ready?

## UX direction

### Primary UX model

Use a web control room layout:

```txt
┌───────────────┬──────────────────────────────────────────────┬────────────────────┐
│ Navigation    │ Current run                                  │ Live / Actions      │
│               │                                              │                    │
│ Projects      │ Goal                                         │ Safe next action    │
│ Runs          │ Add docs site and CI                         │ Needs fix           │
│ Tasks         │                                              │                    │
│ Settings      │ Phase timeline                               │ Reviewer found      │
│               │ Planner   ✓                                  │ blocked issue       │
│ Recent runs   │ Builder   ✓                                  │                    │
│ ! docs build  │ Reviewer  !                                  │ [Preview fix]       │
│ ✓ CR-6        │ Fix       ready                              │ [Open artefact]     │
│ ! provider    │ Checks    blocked                            │                    │
├───────────────┴──────────────────────────────────────────────┴────────────────────┤
│ Artefacts / reviewer output / diffs / logs / audit trail                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

This gives the user:

- Left: where am I?
- Centre: what happened?
- Right: what should I do?
- Bottom/detail: what is the evidence?

### Product feel

The web app should feel closer to:

- Linear for task clarity
- GitHub Actions for run progression
- Vercel for deployment/run readability
- GitHub PR UI for review and merge-readiness
- local developer tooling, not a SaaS admin panel

Avoid:

- chat-first workflows
- generic metrics cards
- CI/CD-only language
- web UI that shells out to CLI commands
- duplicated orchestration logic in React components

Use MergeWright language:

- Run
- Stage
- Phase
- Planner
- Builder
- Reviewer
- Fix attempt
- Checks
- Report
- Artefact
- Safety gate
- Blocked reason
- Safe next action
- Command preview
- Approval gate

## Architecture principle

The web app must not own orchestration.

Correct architecture:

```txt
Web UI
  ↓ typed HTTP request
Fastify API
  ↓ application service/use case
Domain/core
  ↓ adapter port
Codex / shell / GitHub / filesystem / database
```

Bad:

```txt
Web UI -> shell out to CLI -> parse stdout -> mutate local UI state
Web UI -> direct filesystem writes
Web UI -> direct git mutations
Fastify route -> inline orchestration implementation
```

Good:

```txt
CLI -> application service -> orchestration core
API -> application service -> orchestration core
Web -> Fastify API -> application service -> orchestration core
```

The web app should only own:

- selected run
- selected phase
- selected artefact
- selected tab/panel
- filters
- local loading/error state
- command preview UI state
- modal/dialog state

The application/domain layer should own:

- config loading
- workspace validation
- stage discovery
- run inspection
- phase state
- artefact index
- event stream
- safety gates
- available actions
- run continuation
- fix request
- report generation
- provider execution
- audit records

## Accepted stack

Recommended stack:

```txt
apps/web:
  Next.js
  React
  TypeScript
  Tailwind CSS
  shadcn/ui or Radix primitives
  TanStack Query
  Monaco Editor later for artefacts, diffs, and code views

apps/api:
  Fastify
  TypeScript
  Zod
  Server-Sent Events for live run events

persistence:
  Postgres + Drizzle as the target durable store
  filesystem remains inspectable for artefacts
```

Rationale:

- MergeWright is already TypeScript/Node-oriented.
- Next.js provides a mature React foundation for complex local dashboards.
- Fastify keeps the orchestration API explicit and testable.
- Zod keeps API boundaries typed and validated.
- TanStack Query handles API state, caching, refetching, and mutations cleanly.
- SSE is enough for one-way live run/event progress before collaborative features exist.
- Monaco can be added when artefact, diff, and code viewing need richer rendering.

## Proposed folder structure

```txt
apps/
  api/
    src/
      server.ts
      routes/
        health.ts
        runs.ts
        artifacts.ts
        events.ts
        commands.ts
      plugins/
      test/

  web/
    app/
      runs/
        page.tsx
        [runId]/page.tsx
      tasks/page.tsx
      settings/page.tsx
    components/
      run-list.tsx
      run-timeline.tsx
      artifact-list.tsx
      reviewer-findings.tsx
      safe-actions.tsx
      live-events.tsx
    lib/
      api-client.ts
      query-keys.ts

packages/ or src/
  application/
    commands/
    queries/
    use-cases/
    read-models/
  core/
    runs/
    tasks/
    artifacts/
    events/
    policies/
  executors/
    codex/
    shell/
    github/
  db/
    schema/
    repositories/
  shared/
    api-schemas/
```

The exact monorepo shape can be introduced incrementally. Do not block the first API/web slice on a large package restructure.

## MVP scope

### MVP 1: Read-only web run inspector

First shippable web slice.

Features:

- Start local Fastify API.
- Start local web app.
- Show active project/workspace context where available.
- List recent/demo runs.
- Select a run.
- Show run summary.
- Show phase timeline.
- Show phase statuses.
- Show artefact list.
- Show reviewer findings.
- Show blocked reason.
- Show safe next action as display-only.

Do not include yet:

- Start run.
- Continue run.
- Request fix.
- Write-enabled execution.
- Commit.
- Merge.
- Provider switching.
- Hosted auth/team mode.

### MVP 2: Live events and artefact detail

Features:

- Server-Sent Events for run events.
- Live event panel.
- Artefact content endpoint.
- Markdown artefact rendering.
- Log/output artefact rendering.
- Basic error, empty, and loading states.

### MVP 3: Controlled commands

Features:

- Command preview panel.
- Execute low-risk safe actions.
- Display command results.
- Display command audit records.
- Confirmation flow for medium/high-risk actions.
- Continue run and retry phase behind shared policies.

### MVP 4: Real execution

Features:

- Start read-only planner/reviewer run.
- Continue run.
- Retry reviewer/fix phase.
- Execute builder behind safety checks.
- Persist run events and artefacts.
- Show blocked preconditions.

### MVP 5: PR and CI cockpit

Features:

- PR status panel.
- Changed files list.
- Diff viewer.
- CI checks panel.
- Review status.
- Unresolved conversations.
- Merge-readiness check.
- Safe merge action behind policy.

## API contract sketch

Initial read endpoints:

```txt
GET /health
GET /runs
GET /runs/:runId
GET /runs/:runId/artifacts
GET /runs/:runId/artifacts/:artifactId
GET /runs/:runId/events
```

Initial command endpoints:

```txt
POST /commands
POST /runs
POST /runs/:runId/actions/continue
POST /runs/:runId/actions/retry-phase
POST /tasks/:taskId/actions/select
```

The command-specific endpoints may be implemented as wrappers over `POST /commands` if that keeps the API simpler.

## Read models

The web app should consume generic read models, not TUI models.

Suggested names:

```txt
RunSummary
RunDetail
RunPhase
RunArtifact
ReviewerFinding
SafeAction
RunEvent
CommandResult
CommandDescription
CommandAuditRecord
```

Avoid:

```txt
TuiRunStatus
TuiPhaseStatus
RunListItemViewModel as a TUI-owned type
Terminal-specific selection state in API DTOs
```

## Safety model

All write-capable actions must flow through shared command policy.

Requirements:

- low-risk commands may execute directly
- medium-risk commands require preview
- high-risk commands require explicit confirmation
- dangerous commands must be blocked unless policy allows them
- command audit records must be written for success and failure
- web UI must render policy output, not reimplement policy decisions

## Testing strategy

API:

- route tests for `/health`, `/runs`, `/runs/:runId`
- validation tests for command endpoints
- repository contract tests
- event stream tests once SSE exists

Application:

- query service tests
- command use-case tests
- command risk/confirmation tests
- audit record tests

Web:

- component tests for run list, timeline, artefact list, reviewer findings, and safe actions
- API client tests with mocked fetch
- smoke test for run list/detail once app shell exists

Architecture tests:

- web app must not import server-only orchestration modules
- web app must not import shell/process execution code
- API routes must call application services rather than executor adapters directly
- UI must not parse CLI stdout for product state

## First implementation slice

Recommended first PR after docs:

```txt
Title:
Extract reusable run read models from TUI-specific types

Scope:
- move reusable run/task/artefact types into application read models
- rename Tui* types to generic names where safe
- keep existing TUI compiling temporarily
- add tests for pure read-model helpers

Why:
This breaks the TUI-specific model lock-in before API/web code is added.
```

Second PR:

```txt
Title:
Add run query service with in-memory repository

Scope:
- add RunQueryService
- add InMemoryRunRepository
- migrate spike fixture data into seedDemoRuns()
- add unit tests

Why:
This creates the first shared read path for Fastify and web.
```

Third PR:

```txt
Title:
Add Fastify run read API

Scope:
- add API server factory
- add GET /health
- add GET /runs
- add GET /runs/:runId
- wire to RunQueryService
- add route tests

Why:
This creates the backend boundary the web app will consume.
```

Fourth PR:

```txt
Title:
Add web run dashboard shell

Scope:
- add Next.js app shell
- add run list page
- add run detail page
- fetch from Fastify API
- render phases, artefacts, findings, and safe actions

Why:
This gives MergeWright its first useful web control room without changing orchestration execution.
```

## TUI cleanup timing

Do not delete the current TUI code immediately if doing so would destroy useful extraction points.

Delete or quarantine it after:

- shared read models exist
- query services exist
- Fastify read API exists
- web run inspector can show equivalent useful run state

Then remove:

- TUI scripts
- Ink dependency if unused
- TUI-specific tests that are not migrated
- active TUI docs
- `src/tui/**` if no longer needed
