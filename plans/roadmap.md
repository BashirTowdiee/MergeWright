# MergeWright Web-First Roadmap

Status: active

Scope: move MergeWright from a TUI-primary product path to a web-first local control room backed by a shared application service layer and Fastify API.

## Product direction

The TUI is no longer the target product surface. Existing TUI work may be mined for useful command, event, read-model, and safety abstractions, but future interface investment goes into the web app.

Primary surfaces:

```text
Web app -> Fastify API -> application services -> domain/use cases -> adapters
CLI     -> application services -> domain/use cases -> adapters
```

Non-goals:

```text
TUI as primary interface
TUI feature expansion
web app shelling out to CLI commands
web app parsing CLI stdout for product state
API routes owning orchestration logic
duplicated orchestration in CLI/web/TUI
```

## Architectural rule

Allowed path:

```text
Web UI -> typed API request -> Fastify route -> application service -> domain/use case -> adapter
CLI    -> typed command     -> application service -> domain/use case -> adapter
```

Forbidden paths:

```text
Web UI -> shell command
Web UI -> direct file edit
Web UI -> parse CLI stdout
Web UI -> mutate git/plans/runs directly
API route -> orchestration logic inline
API route -> bypass write-safety checks
UI surface -> duplicate command policy
```

The Fastify API is the orchestration boundary for the web app. The CLI remains the automation surface. Both must share the same application services and safety policies.

## Stage 0: Freeze and retire TUI roadmap work

Goal: stop new TUI product work and preserve only reusable internals.

Deliverables:
- roadmap update marking web as the primary interface path
- product docs updated to remove TUI-primary language
- TUI implementation plan marked superseded
- active planning files updated with web-first next actions

Acceptance criteria:
- docs no longer describe TUI as the primary human interface
- no new roadmap stage depends on Ink or TUI panes
- existing TUI code is treated as legacy spike/client code
- reusable command/event/read-model concepts remain available for extraction

Next action:
- extract reusable non-TUI read models and command services before creating broad web UI code.

## Stage 1: Shared domain and read-model extraction

Goal: remove TUI-specific naming from reusable run, task, artefact, and action models.

Deliverables:
- generic run summary and run detail read models
- generic phase, artefact, reviewer finding, and safe action models
- TUI-specific `Tui*` names renamed or wrapped in non-TUI types
- demo seed data separated from Ink component fixtures

Acceptance criteria:
- shared read models do not mention TUI, Ink, panes, overlays, or terminal concepts
- UI-specific state remains outside application/domain models
- current tests continue to pass while extraction is incremental
- demo data can seed in-memory repositories without direct React component props

Dependencies:
- current `src/tui/view-models.ts` and spike fixture concepts

Next action:
- move reusable run/task/artefact types into `src/application/read-models` or a future `packages/application` boundary.

## Stage 2: Query services and in-memory repositories

Goal: create the read path the web app and API will consume.

Deliverables:
- `RunQueryService`
- `TaskQueryService`
- `ArtifactQueryService`
- `EventQueryService`
- in-memory run/task/event repositories
- seeded demo workspace data

Acceptance criteria:
- run list and run detail data can be read without TUI fixtures
- query services are framework-agnostic
- query services have deterministic unit tests
- no query service imports React, Ink, Fastify, or CLI presentation code

Dependencies:
- Stage 1 shared read models

Next action:
- implement `RunQueryService` and an in-memory repository first.

## Stage 3: Application command/use-case layer hardening

Goal: convert the existing command facade into backend-owned use cases that both API and CLI can call.

Deliverables:
- use cases for select task, update coordination note, start run, continue run, retry phase, and execute builder
- command validation in application services
- command risk and confirmation policy preserved outside UI code
- command audit model retained and extended
- ports for run repository, task repository, event bus, and agent executor

Acceptance criteria:
- command execution is not stubbed in UI code
- API and CLI can call the same command service
- command results are structured and serialisable
- missing handlers fail deterministically with stable result codes
- risky commands are blocked by policy before adapters execute

Dependencies:
- existing `src/application/commands/*`
- Stage 2 repository ports

Next action:
- introduce explicit use cases behind `DefaultAppCommandService` without changing CLI behaviour.

## Stage 3.5: Monorepo and CLI boundary refactor

Goal: move from a root `src`-centred implementation to explicit workspace boundaries before API and web growth make the module structure harder to untangle.

Target structure:

```text
apps/
  cli/
    src/
      main.ts
      commands/
      presentation/
  api/
    src/
      server.ts
      routes/
  web/
    src/
      app/
      components/

packages/
  application/
    src/
      commands/
      read-models/
      services/
      use-cases/
  domain/
    src/
      models/
      policies/
      results/
  adapters/
    src/
      codex/
      filesystem/
      github/
      shell/
  config/
    src/
      loaders/
      schemas/
  shared/
    src/
      errors/
      ids/
      result/
```

Allowed CLI dependency path:

```text
apps/cli -> packages/application -> packages/domain -> packages/adapters
```

Deliverables:
- workspace configuration for the root package manager
- `apps/cli` entry point and command presentation layer
- `packages/application` for command services, read models, orchestration use cases, and ports
- `packages/domain` for pure models, policies, result codes, and risk rules
- `packages/adapters` for filesystem, shell, Codex, GitHub, and process-bound integrations
- `packages/config` for config schemas, loaders, and validation
- `packages/shared` for small cross-cutting primitives that do not own product logic
- package-level TypeScript build configuration
- updated CLI binary and npm scripts

Acceptance criteria:
- root package uses workspaces or an equivalent explicit multi-package layout
- CLI binary points at the `apps/cli` build output instead of `dist/src/cli.js`
- root `src/cli.ts` is removed or reduced to a temporary compatibility shim
- CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping
- orchestration logic, workspace mutation logic, provider execution, GitHub logic, config loading, and risk policy do not live in CLI presentation code
- API and CLI import the same application services rather than duplicating command logic
- no web, API, or TUI code imports CLI files
- tests are moved near package boundaries or kept in an intentional root integration test folder
- existing CLI behaviour remains compatible for documented commands during the migration

Dependencies:
- Stage 3 command/use-case layer
- existing `src/cli.ts`, `src/application/**`, adapter-like modules, and root scripts

Migration order:
1. Add workspace configuration and package folders without changing runtime behaviour.
2. Move the CLI entry point into `apps/cli` and keep a temporary compatibility shim only if needed.
3. Move command services, query services, read models, and use cases into `packages/application`.
4. Move pure models, policies, result types, and risk rules into `packages/domain`.
5. Move filesystem, shell, Codex, GitHub, and process integrations into `packages/adapters`.
6. Move config schemas and loading into `packages/config`.
7. Update package scripts, TypeScript references, binary paths, and tests.
8. Resume API and web stages against the new package boundaries.

Next action:
- implement the workspace skeleton and move only the CLI entry point first, preserving command behaviour and tests.

## Stage 4: Fastify API foundation

Goal: expose application reads and commands to the web app through a typed local API.

Deliverables:
- `apps/api` or equivalent API entry point
- Fastify server factory
- Zod request/response schemas
- health route
- run list and run detail routes
- artifact list/content routes
- command submission route
- route tests

Initial endpoints:

```text
GET  /health
GET  /runs
GET  /runs/:runId
GET  /runs/:runId/artifacts
GET  /runs/:runId/artifacts/:artifactId
POST /commands
```

Acceptance criteria:
- Fastify routes call application services only
- route handlers contain no orchestration logic
- request and response payloads are schema-validated
- API can run against in-memory repositories first
- route tests cover success and validation failure paths

Dependencies:
- Stage 2 query services
- Stage 3 command service hardening
- Stage 3.5 monorepo and CLI boundary refactor

Next action:
- add read-only `/health`, `/runs`, and `/runs/:runId` first.

## Stage 5: Web app shell

Goal: create the first useful web control room over the Fastify API.

Deliverables:
- `apps/web` or equivalent web entry point
- Next.js app shell
- run list page
- run detail page
- phase timeline
- artefact list
- reviewer findings panel
- safe actions panel
- API client using shared schemas

Recommended stack:

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui or Radix primitives
TanStack Query
Monaco Editor later for artefacts, diffs, and code views
```

Acceptance criteria:
- web app fetches runs from Fastify
- web app renders selected run detail from API data
- web app does not import server-only orchestration code
- web app can display blocked reasons, phases, artefacts, reviewer findings, and safe actions
- UI state is limited to selection, filters, panels, and local presentation state

Dependencies:
- Stage 4 Fastify read API

Next action:
- implement `/runs` and `/runs/[runId]` before command execution controls.

## Stage 6: Structured events and live progress

Goal: stream run and command progress to the web app without stdout scraping.

Deliverables:
- application event model
- event bus abstraction
- persisted or in-memory event store
- Fastify Server-Sent Events endpoint
- web live event panel
- command start/finish and phase start/finish events

Initial endpoint:

```text
GET /runs/:runId/events
```

Acceptance criteria:
- web app receives typed progress events
- command and phase lifecycle events are represented structurally
- output chunks may be captured as events or artefacts, but product state does not depend on parsing raw stdout
- event stream can reconnect without losing persisted events once persistence exists

Dependencies:
- Stage 3 command service hardening
- Stage 4 Fastify API foundation

Next action:
- stream command started/finished events from the existing evented command service pattern.

## Stage 7: Persistence and artefact indexing

Goal: make run history durable and queryable.

Deliverables:
- durable run repository
- durable event repository
- durable command audit store
- artefact metadata index
- migrations and repository tests

Recommended persistence:

```text
Postgres + Drizzle
```

Local-first bootstrap may use SQLite only if it materially speeds local development. The target product path should not depend on UI state for history.

Acceptance criteria:
- API restart does not lose run history
- run events are persisted
- command audit records are persisted
- artefact metadata is queryable by run and phase
- filesystem artefacts remain inspectable by developers

Dependencies:
- Stage 2 repository ports
- Stage 4 API foundation

Next action:
- persist run summaries/details and events before implementing complex web controls.

## Stage 8: Real orchestration execution

Goal: wire real planner, reviewer, fix, and builder execution behind application services.

Deliverables:
- Codex executor adapter
- shell executor adapter where needed
- artifact writer/indexer
- workspace safety service
- start-run, continue-run, retry-phase, and execute-builder handlers
- structured failure/blocker model

Acceptance criteria:
- starting a run creates a durable run record
- phase transitions are persisted and streamed
- artefacts are written and indexed
- failures produce structured blocker reasons
- retry uses stored run context
- write-enabled actions cannot bypass safety gates

Dependencies:
- Stage 3 command/use-case layer
- Stage 6 events
- Stage 7 persistence

Next action:
- wire read-only start-run before builder execution.

## Stage 9: Web command controls and approval gates

Goal: make the web app an operator control room, not only a viewer.

Deliverables:
- command preview panel
- risk and confirmation UI
- safe action execution
- command result display
- audit log panel
- blocked precondition display

Acceptance criteria:
- low-risk commands can execute from the web UI
- medium/high-risk commands require preview and confirmation according to shared policy
- web UI does not duplicate risk logic
- command results and audit records are visible after execution
- unsafe commands fail before adapter invocation

Dependencies:
- Stage 5 web shell
- Stage 8 real execution

Next action:
- implement select-task/coordination note controls before run execution controls.

## Stage 10: PR, CI, and merge-readiness panels

Goal: make the web app the clearest place to decide whether work can merge.

Deliverables:
- PR status panel
- changed files and diff viewer
- CI checks panel
- review status panel
- unresolved conversation display
- merge-readiness service
- safe merge action behind policy

Acceptance criteria:
- web app shows PR readiness without terminal inspection
- merge action is blocked unless merge policy passes
- failed CI links to logs or structured summaries
- expected head SHA is used where available
- GitHub operations are auditable

Dependencies:
- Stage 7 persistence
- Stage 8 execution
- GitHub adapter availability

Next action:
- implement read-only PR/CI status before merge actions.

## Stage 11: TUI removal and cleanup

Goal: remove the abandoned TUI surface once web parity exists for useful run inspection.

Deliverables:
- remove TUI scripts
- remove Ink dependency if no longer used
- remove or quarantine `src/tui/**`
- migrate reusable tests to application/web/API layers
- README points users to CLI and web surfaces only

Acceptance criteria:
- no runtime dependency on Ink remains unless explicitly retained for a demo
- no active docs describe TUI as the product path
- no test imports deleted TUI code
- CI passes after cleanup

Dependencies:
- Stage 5 web shell reaches useful run inspection parity

Next action:
- do not delete TUI code until the shared read models and web shell are in place.

## Stage 12: Product hardening

Goal: make the web-first MergeWright workflow reliable for daily local use and future team adoption.

Deliverables:
- local dev bootstrap command
- API/web startup scripts
- workspace selection and validation
- empty/loading/error states
- API/web smoke tests
- documentation and screenshots
- provider/model settings
- optional desktop packaging evaluation

Acceptance criteria:
- user can start API and web locally with documented commands
- web app explains missing workspace/config/run states clearly
- CLI remains usable for automation
- web app is the documented human control room
- architecture still supports future hosted/team mode without forcing it now

Dependencies:
- prior web/API stages

Next action:
- document local API/web startup once Stage 4 and Stage 5 exist.
