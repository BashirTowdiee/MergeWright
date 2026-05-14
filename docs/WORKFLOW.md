# Workflow Guide (v1)

This guide describes the normal operator flow for the standalone orchestrator in read-only mode.

## A) Create A New Project Config

```bash
npm run agent -- init-project "My App" --workspace /path/to/repo
```

This creates orchestrator-side files only:

- `configs/my-app.json`
- `stages/my-app/example-stage.md`
- `runs/my-app/.gitkeep`

## B) Create A Stage File

Example path:

- `stages/my-app/stage-01-example.md`

Stage names map to filenames without `.md`, so this stage is referenced as `stage-01-example`.

## C) Plan Only

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan
```

Use this when you want planner extraction and artefact generation before requesting later phases.
The command now prints live phase progress so long-running Codex/check steps do not appear idle.

## D) Inspect The Run

```bash
npm run agent -- list-runs --config configs/my-app.json
npm run agent -- show-run <run-id> --config configs/my-app.json
```

Use `list-runs` to find run ids and `show-run` to inspect status, warnings, and artefacts.

## E) Continue Manually

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer
npm run agent -- continue-run <run-id> --config configs/my-app.json --plan-fix
```

You can also continue with `--execute-fix` and/or `--run-checks` when prerequisites are satisfied.

## F) Full Read-Only Dry Run

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset full-readonly --dry-run
```

This is the safest full-pipeline preview for v1 behavior.

## G) Auto-Chain Projection (Stage B)

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --auto-chain --dry-run
```

Stage B behavior:

- validates config loading and stage name
- prints projected auto-chain flow
- does not execute Codex
- does not run checks
- does not mutate workspace/git state

`--max-fix-attempts <n>` is accepted only with `--auto-chain` and must be an integer `0..5` (default `1`).
`--auto-chain` without `--dry-run` is intentionally rejected until Stage C implementation.

## When To Use `run`

Use `run` when you want:

- a new run directory
- a clean execution record
- preset-driven or explicit phase selection from the start

## When To Use `continue-run`

Use `continue-run` when you want to:

- resume specific phases in an existing run
- avoid creating another run directory
- step through phases manually after inspecting previous outputs

Do not use it for planner execution; planner continuation is unsupported.

## When To Use `--dry-run`

Use `--dry-run` when you need to:

- validate flags and phase dependencies
- preview orchestration safely
- generate non-execution artefacts/status placeholders

`--dry-run` does not execute Codex or configured checks.

## When To Use Presets

Use presets for repeatability:

- `plan`: planner only
- `build`: planner + builder
- `review`: planner + builder + reviewer
- `fix-plan`: planner + reviewer + fix planning
- `full-readonly`: planner + builder + reviewer + fix planning + fix execution + checks

Presets reduce CLI mistakes and make intent explicit.

## How To Interpret `run.json`

Key fields to inspect:

- `status`: run-level `running|success|failed`
- `resolvedOptions`: exact flags applied after preset resolution
- `phases.<phase>.status`: per-phase state
- `error`: failure summary and failed phase
- `artefacts`: known output files

Treat `run.json` as the source of truth for run state.

## How To Inspect Artefacts

Primary inspection flow:

1. Use `show-run` for summary and warnings.
2. Open the run directory (`open-run` on macOS).
3. Inspect phase-specific files (`*-stdout.log`, `*-stderr.log`, `*-exit.json`, prompt previews, parse outputs).

Terminal progress output is intentionally concise by default and does not stream full Codex stdout/stderr. Use `--stream-codex` when you want live raw Codex output while keeping artefacts, or inspect run artefacts for full logs.

## What To Commit Manually

Because v1 is read-only orchestration:

- commit orchestrator config/stage/doc updates as needed
- commit target-repo code changes manually (outside orchestrator automation)
- push manually

No auto-commit/push behavior is provided by this tool.
