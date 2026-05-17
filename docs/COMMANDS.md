# Command Reference

Use command-level help to verify the latest parser options:

```bash
npm run agent -- --help
npm run agent -- <command> --help
```

## Classic run commands

### `init-project`

Create orchestrator-side config, stage, and run scaffolding for a target repository.

```bash
npm run agent -- init-project <name> --workspace <path> [--force] [--verbose]
```

Notes:

- writes inside the orchestrator repo only
- validates the target workspace path
- does not mutate the target repo

### `run`

Create a new classic run directory and execute selected phases or a preset.

```bash
npm run agent -- run <stage-name> --config <config-path> [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]
```

Common examples:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --preset full-readonly --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --auto-chain --allow-writes --max-fix-attempts 2
```

Notes:

- creates `runs/<project>/<run-id>/`
- `--auto-chain` is supported only for `run`
- `--auto-chain` cannot be combined with presets or explicit phase flags
- auto-chain fix attempts are bounded by `--max-fix-attempts` with hard range `0..5`
- classic `run --auto-chain` does not auto-commit, auto-push, auto-merge, or auto-accept

### `continue-run`

Resume selected phases in an existing classic run directory.

```bash
npm run agent -- continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]
```

Notes:

- requires at least one continuation phase flag
- planner continuation is unsupported
- presets are unsupported for `continue-run`
- does not auto-commit, auto-push, auto-merge, or auto-accept

### `list-runs`, `show-run`, `open-run`

Inspect classic run artefacts.

```bash
npm run agent -- list-runs --config configs/my-app.json
npm run agent -- show-run <run-id> --config configs/my-app.json
npm run agent -- open-run <run-id> --config configs/my-app.json
```

### `report-run`

Generate AI Change Report artefacts for an existing run.

```bash
npm run agent -- report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]
```

Notes:

- reads existing run artefacts only
- does not execute Codex
- does not run checks
- does not run git commands
- does not mutate the target workspace

### `check-write-safety`

Inspect whether a target repo is ready for a future write-enabled builder/fix run.

```bash
npm run agent -- check-write-safety --config <config-path>
```

Notes:

- read-only git inspection only
- does not execute Codex
- does not mutate workspace files
- exits non-zero when readiness fails

## Stage Plan commands

Stage Plan commands operate on a canonical `stage-plan.json` path. They are designed for one-stage-at-a-time, human-gated delivery.

### `import-stage-plan`

Validate an existing Stage Plan JSON file and render canonical JSON and Markdown artefacts.

```bash
npm run agent -- import-stage-plan --from <path> --out <path> [--force]
```

Required flags:

- `--from <path>` source Stage Plan JSON
- `--out <path>` output run directory

Optional flags:

- `--force` overwrite existing `stage-plan.json` and `stage-plan.md`

Example:

```bash
npm run agent -- import-stage-plan \
  --from docs/examples/stage-plan.example.json \
  --out .artifacts/runs/provider-switching
```

Artefacts:

- `<out>/stage-plan.json`
- `<out>/stage-plan.md`

Does not:

- execute planner/builder/reviewer
- run checks
- run git commands
- mutate stage statuses

Failure modes:

- missing `--from`
- missing `--out`
- invalid JSON
- invalid Stage Plan schema
- target artefacts already exist without `--force`

### `run-stage`

Run exactly one selected Stage Plan stage and stop at `review_required`.

```bash
npm run agent -- run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]
```

Required args:

- `<stage-id>` stage to run
- `--stage-plan <path>` canonical Stage Plan JSON
- `--config <config-path>` project config for execution

Notes:

- validates stage status and dependencies
- only `pending` and `failed` stages are runnable
- dependencies must be `accepted` or `committed`
- successful execution sets the selected stage to `review_required`
- persists `stage-plan.json` and regenerates `stage-plan.md`
- writes per-stage artefacts under `<run-dir>/stages/<stage-id>/`
- `--auto-commit` is rejected because the stage has not been accepted

Does not:

- run any other stage
- accept the stage
- commit changes
- reassess downstream stages

### `run-stages`

Run the next linear stage and stop after that stage.

```bash
npm run agent -- run-stages --stage-plan <path> --stop-after-each-stage --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]
```

Current SP-5 behaviour:

- `--stop-after-each-stage` is required
- runs at most one stage per invocation
- uses conservative linear progression
- a blocked earlier pending/failed stage prevents skipping ahead
- successful execution stops at `review_required`
- Stage Plan status becomes `paused` after a successful stage run

Does not:

- auto-accept
- auto-commit
- run a full chain
- skip review gates

`--auto-commit` is rejected.

### `continue-stages`

Continue to the next Stage Plan stage after prior gates are satisfied.

```bash
npm run agent -- continue-stages --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]
```

Continuation is blocked when:

- any stage is `review_required`
- a dependency is not `accepted` or `committed`
- the next stage is `needs_revision`
- the next stage is `invalidated`

Does not:

- auto-accept
- auto-commit
- run more than one stage
- rewrite stale stage definitions

`--auto-commit` is rejected.

### `accept-stage`

Mark one reviewed stage as accepted without execution.

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path> [--auto-commit] [--commit-message "<text>"]
```

Allowed source statuses:

- `review_required`
- `passed`

Behaviour without `--auto-commit`:

- sets selected stage to `accepted`
- persists `stage-plan.json`
- regenerates `stage-plan.md`
- updates stage report
- does not run planner/builder/reviewer/checks
- does not run git commands

Behaviour with `--auto-commit`:

- first accepts the stage
- checks git availability
- requires non-empty diff
- validates changed files against stage `scope.include` and `scope.exclude`
- commits using default or custom commit message
- retrieves HEAD SHA
- records `commitSha`
- sets selected stage to `committed`
- persists `stage-plan.json`
- regenerates `stage-plan.md`
- updates stage report with commit SHA

Default commit message:

```text
stage(<stage-id>): <stage title>
```

Failure modes:

- stage is not `review_required` or `passed`
- git unavailable
- no diff
- scope violation
- commit failure
- HEAD SHA retrieval failure

On auto-commit failure, the stage is not marked `committed` and `commitSha` is not set.

### `fix-stage`

Apply human feedback to one uncommitted stage and return it to review.

```bash
npm run agent -- fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback "<text>" [--reassess-downstream] [--allow-writes] [--verbose] [--stream-codex]
```

Notes:

- requires non-empty `--feedback`
- refuses committed stages and any stage with `commitSha`
- writes feedback artefacts under `<run-dir>/stages/<stage-id>/`
- scopes execution to the selected stage only
- increments revision on successful fix
- returns the selected stage to `review_required`
- `--reassess-downstream` runs reassessment only after successful fix

Does not:

- continue to the next stage
- auto-accept
- auto-commit
- rewrite committed history

### `reassess-stage-plan`

Classify downstream stages after a source stage changes.

```bash
npm run agent -- reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run] [--verbose]
```

Required flags:

- `--stage-plan <path>`
- `--from <stage-id>` source stage to reassess from
- `--config <config-path>` when model execution is required

Classifications:

- `unchanged`
- `needs_revision`
- `invalidated`

Behaviour:

- identifies downstream stages
- builds a classification-only reassessment prompt
- validates structured JSON result
- writes reassessment artefacts under `<run-dir>/reassessments/<source-stage-id>/revision-<revision>/`
- marks downstream stages as `needs_revision` or `invalidated` when classified that way
- leaves `unchanged` stages untouched

Does not:

- implement code
- rewrite downstream stage definitions
- accept stages
- commit changes
- run downstream implementation stages

## Command-level help

```bash
npm run agent -- import-stage-plan --help
npm run agent -- run-stage --help
npm run agent -- run-stages --help
npm run agent -- accept-stage --help
npm run agent -- fix-stage --help
npm run agent -- reassess-stage-plan --help
npm run agent -- continue-stages --help
```

## Documentation links

- `docs/STAGE_PLAN_WORKFLOW.md`
- `docs/WORKFLOW.md`
- `docs/SAFETY.md`
- `docs/WRITE_MODE.md`
