# Roadmap

## Status

Accepted roadmap, updated for the web-first interface direction.

## Roadmap purpose

This roadmap turns the product direction into staged delivery. MergeWright keeps the CLI as the automation and scripting surface, while the web app becomes the primary human control room for supervising local agent workflows, inspecting artefacts, reviewing blockers, and making safe next-action decisions.

## Roadmap principles

- Build the web app as a first-class product surface, not a visual wrapper over the CLI.
- Put orchestration behind shared application services and use cases.
- Put the Fastify API between the web app and orchestration services.
- Do not parse CLI stdout for product state.
- Preserve local-first operation throughout the roadmap.
- Keep the CLI useful for automation and dogfooding.
- Stabilise state, artefact, event, and command contracts before adding advanced web controls.
- Treat existing TUI work as reusable spike material, not the future product path.
- Prefer thin vertical slices over broad unfinished platform work.

## Phase 1: Product foundation

Goal: formalise MergeWright as a product, not only a CLI implementation.

Deliverables:

- Product discovery.
- Product requirements.
- Product design.
- Decision and open-question register.
- Web-first UX direction.
- Architecture plan.
- Run lifecycle definition.
- Artefact model definition.
- Provider abstraction direction.

Exit criteria:

- Product positioning is clear.
- Web app is documented as the primary human interface.
- CLI is documented as the automation surface.
- TUI is documented as superseded or deprecated.
- Current, proposed, and future scope are separated.
- Product docs can guide implementation prompts.

## Phase 2: Shared state and application contracts

Goal: make the current CLI foundation stable, inspectable, and ready for API/web consumption.

Deliverables:

- Tighten run state model.
- Define public run status and phase status names.
- Add or formalise artefact index.
- Add lifecycle event output, where missing.
- Improve continuation semantics.
- Improve auto-chain controls.
- Improve change report output.
- Extract reusable non-TUI read models from the current TUI spike.
- Ensure CLI output and metadata align.

Exit criteria:

- A run can be inspected through machine-readable data without parsing arbitrary Markdown.
- Run status, phase status, blocked reason, available actions, and artefact references are stable.
- Existing CLI behaviour remains compatible.
- Shared read models do not depend on Ink, React, or terminal UI state.

## Phase 3: Query services and local repositories

Goal: create a framework-agnostic read path for API and web.

Deliverables:

- Run query service.
- Task query service.
- Artefact query service.
- Event query service.
- In-memory repositories for demo and tests.
- Seeded demo workspace data migrated out of TUI fixtures.

Exit criteria:

- Run list and run detail data can be read without TUI fixtures.
- Query services are testable without Fastify or React.
- Demo data can seed repositories for API/web development.

## Phase 4: Application command/use-case hardening

Goal: convert the existing command facade into backend-owned use cases for API and CLI.

Deliverables:

- Use cases for select task, update coordination note, start run, continue run, retry phase, and execute builder.
- Command validation in application services.
- Command risk and confirmation policy outside UI code.
- Command audit model.
- Ports for run repository, task repository, event bus, and agent executor.

Exit criteria:

- Command execution is not stubbed in UI code.
- CLI and API can call the same command services.
- Command results are structured and serialisable.
- Risky commands are blocked by shared policy before adapters execute.

## Phase 5: Fastify API foundation

Goal: expose application reads and commands through a typed local API.

Deliverables:

- Fastify server entry point.
- Zod request/response schemas.
- Health route.
- Run list and run detail routes.
- Artefact list and content routes.
- Command submission route.
- Route tests.

Exit criteria:

- Fastify routes call application services only.
- Route handlers contain no orchestration logic.
- Request and response payloads are schema-validated.
- API can run against in-memory repositories first.
- Route tests cover success and validation failure paths.

## Phase 6: Web app shell

Goal: provide the first useful web interface over the Fastify API.

Deliverables:

- Next.js app shell.
- Run list page.
- Run detail page.
- Phase timeline.
- Artefact list.
- Reviewer findings panel.
- Safe actions panel.
- API client using shared schemas.

Exit criteria:

- Web app fetches runs from Fastify.
- Web app renders selected run detail from API data.
- Web app shows blocked reasons, phases, artefacts, reviewer findings, and safe actions.
- Web app does not import server-only orchestration code.

## Phase 7: Structured events and live progress

Goal: show run and command progress in the web app without stdout scraping.

Deliverables:

- Application event model.
- Event bus abstraction.
- Event store.
- Fastify Server-Sent Events endpoint.
- Web live event panel.
- Command and phase lifecycle events.

Exit criteria:

- Web app receives typed progress events.
- Command and phase lifecycle events are represented structurally.
- Product state does not depend on parsing raw process output.
- Event stream can reconnect without losing persisted events once persistence exists.

## Phase 8: Persistence and artefact indexing

Goal: make run history durable and queryable.

Deliverables:

- Durable run repository.
- Durable event repository.
- Durable command audit store.
- Artefact metadata index.
- Migrations and repository tests.

Preferred persistence:

```txt
Postgres + Drizzle
```

Exit criteria:

- API restart does not lose run history.
- Run events are persisted.
- Command audit records are persisted.
- Artefact metadata is queryable by run and phase.
- Filesystem artefacts remain inspectable by developers.

## Phase 9: Real orchestration execution

Goal: wire real planner, reviewer, fix, and builder execution behind application services.

Deliverables:

- Codex executor adapter.
- Shell executor adapter where required.
- Artefact writer/indexer.
- Workspace safety service.
- Start-run, continue-run, retry-phase, and execute-builder handlers.
- Structured failure/blocker model.

Exit criteria:

- Starting a run creates a durable run record.
- Phase transitions are persisted and streamed.
- Artefacts are written and indexed.
- Failures produce structured blocker reasons.
- Retry uses stored run context.
- Write-enabled actions cannot bypass safety gates.

## Phase 10: Web command controls and approval gates

Goal: make the web app an operator control room, not only a viewer.

Deliverables:

- Command preview panel.
- Risk and confirmation UI.
- Safe action execution.
- Command result display.
- Audit log panel.
- Blocked precondition display.

Exit criteria:

- Low-risk commands can execute from the web UI.
- Medium/high-risk commands require preview and confirmation according to shared policy.
- Web UI does not duplicate risk logic.
- Command results and audit records are visible after execution.
- Unsafe commands fail before adapter invocation.

## Phase 11: PR, CI, and merge-readiness panels

Goal: make the web app the clearest place to decide whether work can merge.

Deliverables:

- PR status panel.
- Changed files and diff viewer.
- CI checks panel.
- Review status panel.
- Unresolved conversation display.
- Merge-readiness service.
- Safe merge action behind policy.

Exit criteria:

- Web app shows PR readiness without terminal inspection.
- Merge action is blocked unless merge policy passes.
- Failed CI links to logs or structured summaries.
- Expected head SHA is used where available.
- GitHub operations are auditable.

## Phase 12: TUI removal and cleanup

Goal: remove the abandoned TUI surface once the web app has useful run-inspection parity.

Deliverables:

- Remove TUI scripts.
- Remove Ink dependency if no longer used.
- Remove or quarantine `src/tui/**`.
- Migrate useful tests to application/web/API layers.
- Update README to point users to CLI and web surfaces only.

Exit criteria:

- No runtime dependency on Ink remains unless explicitly retained for a demo.
- No active docs describe TUI as the product path.
- No tests import deleted TUI code.
- CI passes after cleanup.

## Phase 13: Product hardening

Goal: make the web-first MergeWright workflow reliable for daily local use and future team adoption.

Deliverables:

- Local dev bootstrap command.
- API/web startup scripts.
- Workspace selection and validation.
- Empty/loading/error states.
- API/web smoke tests.
- Documentation and screenshots.
- Provider/model settings.
- Optional desktop packaging evaluation.

Exit criteria:

- User can start API and web locally with documented commands.
- Web app explains missing workspace/config/run states clearly.
- CLI remains usable for automation.
- Web app is the documented human control room.
- Architecture still supports future hosted/team mode without forcing it now.
