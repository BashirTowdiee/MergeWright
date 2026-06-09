# MergeWright

`mergewright` is a local-first AI software delivery harness for controlled, auditable engineering workflows. It keeps the CLI as the scriptable command surface and is evolving toward an audited workflow runner for AI-assisted software changes.

The web app remains the best place for run visibility, approvals, and audit review: launch and continue runs, inspect artefacts, review blockers, execute safe next actions, and expose team-visible review evidence. The CLI remains the automation backbone for scripts, exact commands, CI-style usage, and dogfooding.

It supports Planner -> Builder -> Reviewer workflows, bounded fix loops, write-safety gates, run artefacts, AI Change Reports, and Stage Plans for human-gated multi-stage delivery.

<p align="center">
  <img src="./assets/repoImage.png" alt="MergeWright delivery harness overview" width="900" />
</p>
<p align="center"><em>Structured, auditable orchestration for planner, builder, reviewer, stage plans, bounded fix workflows, and merge-readiness evidence.</em></p>

## Documentation

Start here:

| Area | Link |
| --- | --- |
| Product direction | [Product roadmap](docs/product/04-roadmap.md), [audited workflow runner direction](docs/product/05-audited-workflow-runner-direction.md), [delivery harness roadmap](docs/roadmap/delivery-harness.md) |
| Web interface | [Web interface implementation plan](docs/ux/04-web-interface-implementation-plan.md) |
| Architecture | [Architecture overview](docs/architecture/overview.md) |
| CLI | [Command reference](docs/cli/commands.md) |
| Workflows | [Classic run](docs/workflows/classic-run.md), [Stage Plan](docs/workflows/stage-plan.md) |
| Configuration | [Execution backends](docs/configuration/execution-backends.md) |
| Safety | [Write safety](docs/safety/write-safety.md), [Write mode](docs/safety/write-mode.md) |
| Prompting and operations | [Prompting](docs/PROMPTING.md), [Operations](docs/OPERATIONS.md) |
| Acceptance history | [V1 acceptance](docs/V1_ACCEPTANCE.md), [V2 acceptance](docs/V2_ACCEPTANCE.md) |

## Product position

MergeWright is not trying to be the agent that writes the most code or the runtime that launches the most workers. It sits above coding agents and focuses on delivery confidence.

Core promise:

> Turn AI coding work into reviewable, auditable, merge-ready software changes.

Coding agents generate work. MergeWright governs the delivery path around that work:

```text
intent -> plan -> implementation -> review -> fix loop -> checks -> evidence -> change report -> PR-ready summary
```

The intended operator model is:

```text
Web app -> Fastify API -> application services -> CLI-compatible workflows/use cases -> adapters
CLI     -> application services -> CLI-compatible workflows/use cases -> adapters
```

The web app is the primary human control room for approvals, visibility, and audit review. It should make the CLI workflows usable through a richer interface without making React components own orchestration logic or parse terminal stdout.

MCP should act as a trigger surface for high-level audited run execution. It should start or inspect MergeWright-owned flows rather than orchestrating internal steps itself.

This keeps the project focused on trust, repeatability, evidence, team-visible review, and human-controlled acceptance rather than generic agent orchestration.

## What it solves

Manual LLM-assisted development breaks down when prompts, phase ordering, review gates, and artefacts are handled ad hoc. MergeWright standardises that process by:

- enforcing phase and stage dependencies
- generating consistent prompts from structured context
- storing run, stage, review, reassessment, and report artefacts
- supporting read-only previews before write-enabled execution
- keeping human review gates explicit
- collecting evidence before declaring work acceptable
- allowing optional auto-commit only after explicit stage acceptance

## Delivery harness principles

MergeWright optimises for merge confidence:

1. **Evidence first**: diff, checks, git state, review findings, and acceptance criteria should outrank agent summaries.
2. **Deterministic gates**: stages should only pass when required evidence exists and required checks have run.
3. **Human-gated acceptance**: write execution, fix loops, and commits remain explicit and inspectable.
4. **Backend-agnostic execution**: Codex, Claude Code, OpenCode, CAO, or other runners should be interchangeable execution backends.
5. **Audit-ready output**: every meaningful run should leave enough context to understand what changed, why it changed, how it was checked, and whether it is safe to merge.
6. **Web-first operator experience**: humans should primarily use the web app to run CLI-equivalent workflows, inspect evidence, and share review state with a team.

## Quick start

Install dependencies and check the CLI:

```bash
npm install
npm run build
npm run mergewright -- --help
```

Start the API + web control room (demo-guided slice):

```bash
# API can start without --config (uses project catalog + active/default project)
npm run start --workspace @mergewright/api -- --host 127.0.0.1 --port 3040

# Optional first-run bootstrap: seed default project from a config file
# npm run start --workspace @mergewright/api -- --config config.example.json --host 127.0.0.1 --port 3040

cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace @mergewright/web
```

Then open `http://127.0.0.1:3050`.

## Docker dev stack

Run API + web + docs with one command:

```bash
npm run docker:dev:up
```

Services:

- Web: `http://127.0.0.1:3050`
- API: `http://127.0.0.1:3040`
- Docs: `http://127.0.0.1:4321`

Useful commands:

```bash
npm run docker:dev:logs
npm run docker:dev:down
npm run docker:dev:rebuild
```

Persistence model:

- Runtime project/run/settings data is persisted in Docker named volume `mergewright_artifacts`.
- Code is bind-mounted from the host for local iteration.

Reset persisted Docker state:

```bash
docker compose down -v
```

Finder workspace picker caveat in containers:

- `POST /system/select-workspace` uses macOS `osascript` folder picker.
- Inside Linux containers this picker is not available by default.
- Docker web service sets `NEXT_PUBLIC_WORKSPACE_PICKER_ENABLED=false` to disable the Finder button and avoid failing requests.
- Use manual workspace path entry in the web form, or run API on host if native Finder selection is required.

Project model in API/web:

- Projects are stored in `.artifacts/projects.json`.
- Active project is stored in `.artifacts/web-settings.json` (`project.activeProjectId`).
- Project routes are available: `GET/POST /projects`, `POST /projects/init`, `GET/PUT/DELETE /projects/:projectId`, `GET /projects/:projectId/health`.
- Most run/review/settings/provider/policy/stage/command routes accept optional `projectId` query scoping; when omitted, API uses active/default project.

Project init from web:

- Open `Projects` in the web app.
- Use `Project name` + `Workspace path`.
- Click `Init + Create` to scaffold config/stage/runs and register the project in the catalog.

Create project scaffolding:

```bash
npm run mergewright -- init-project "My App" \
  --workspace /path/to/repo
```

Validate write readiness:

```bash
npm run mergewright -- check-write-safety \
  --config .artifacts/projects/my-app/config.json
```

## Common commands

### Preview a classic stage

```bash
npm run mergewright -- run stage-01-example \
  --config .artifacts/projects/my-app/config.json \
  --preset plan \
  --dry-run
```

### Run a classic stage with bounded fixes

```bash
npm run mergewright -- run stage-01-example \
  --config .artifacts/projects/my-app/config.json \
  --auto-chain \
  --allow-writes \
  --max-fix-attempts 2
```

### Continue an existing run

```bash
npm run mergewright -- continue-run <run-id> \
  --config .artifacts/projects/my-app/config.json \
  --execute-reviewer \
  --run-checks
```

### Inspect run artefacts

```bash
npm run mergewright -- list-runs \
  --config .artifacts/projects/my-app/config.json

npm run mergewright -- show-run <run-id> \
  --config .artifacts/projects/my-app/config.json

npm run mergewright -- open-run <run-id> \
  --config .artifacts/projects/my-app/config.json
```

### Generate an AI Change Report

```bash
npm run mergewright -- report-run <run-id> \
  --config .artifacts/projects/my-app/config.json \
  --pr-summary
```

## Stage Plan workflow

Use Stage Plans when you want to turn an implementation plan into reviewable stages, run one stage at a time, fix stages with human feedback, reassess downstream stages, and optionally commit only after explicit acceptance.

### Import a stage plan

```bash
npm run mergewright -- import-stage-plan \
  --from docs/examples/stage-plan.example.json \
  --out .artifacts/runs/provider-switching
```

### Run the next stage and stop for review

```bash
npm run mergewright -- run-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --stop-after-each-stage \
  --config .artifacts/projects/my-app/config.json \
  --allow-writes
```

### Fix a stage using human feedback

```bash
npm run mergewright -- fix-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config .artifacts/projects/my-app/config.json \
  --feedback "The provider contract still leaks vendor-specific message shapes." \
  --allow-writes
```

### Accept a reviewed stage

```bash
npm run mergewright -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json
```

### Accept and commit a reviewed stage

```bash
npm run mergewright -- accept-stage stage-01-provider-contract \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --auto-commit
```

### Reassess downstream stages

```bash
npm run mergewright -- reassess-stage-plan \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --from stage-01-provider-contract \
  --config .artifacts/projects/my-app/config.json
```

### Continue after gates pass

```bash
npm run mergewright -- continue-stages \
  --stage-plan .artifacts/runs/provider-switching/stage-plan.json \
  --config .artifacts/projects/my-app/config.json \
  --allow-writes
```

For the full guide, see [Stage Plan workflow](docs/workflows/stage-plan.md).

## Workflow summaries

### Classic run workflow

Use `run` and `continue-run` when you want to execute a single stage file through fixed phases or bounded auto-chain control flow.

Classic `run --auto-chain` is bounded and does not commit, push, merge, or auto-accept changes.

Final statuses:

- `PASS`: reviewer passed and checks passed when checks were requested.
- `NEEDS_FIX`: reviewer or checks found issues that need another pass.
- `NEEDS_FIX_WRITE_DISABLED`: a fix was required but write execution was not enabled.
- `MAX_FIX_ATTEMPTS_REACHED`: bounded fix attempts were exhausted.
- `CHECKS_FAILED`: configured checks failed after implementation or fix work.
- `FAILED`: execution failed before a controlled terminal status could be reached.
