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

Generate AI Change Report plus PR summary Markdown from an existing run:

```bash
npm run agent -- report-run <run-id> \
  --config configs/my-app.json \
  --pr-summary
```

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

## G) Auto-Chain Recommended Workflow

Safe preview:

```bash
npm run agent -- run stage-01 \
  --config configs/my-app.json \
  --auto-chain \
  --dry-run
```

Read-only:

```bash
npm run agent -- run stage-01 \
  --config configs/my-app.json \
  --auto-chain
```

Write-enabled:

```bash
npm run agent -- run stage-01 \
  --config configs/my-app.json \
  --auto-chain \
  --allow-writes \
  --max-fix-attempts 2
```

Write-enabled with automatic report refresh:

```bash
npm run agent -- run example-stage \
  --config configs/my-app.json \
  --auto-chain \
  --allow-writes \
  --max-fix-attempts 2 \
  --generate-report
```

`--generate-report` runs only after successful completion. If the primary command fails, automatic report generation is skipped; run `report-run <run-id> --config <config-path>` later when a run directory exists.

AI Change Report policy is optional and configured under `changeReport` in your project config. If omitted, default risk/scoring/scope-drift rules are used. Policy matching uses simple deterministic path rules (exact/prefix/substring), not glob expansion.

Live Codex stream:

```bash
npm run agent -- run stage-01 \
  --config configs/my-app.json \
  --auto-chain \
  --allow-writes \
  --max-fix-attempts 2 \
  --stream-codex
```

Stage E behavior:

- initial pass: planner -> builder -> reviewer -> review-to-fix
- if initial reviewer is `PASS`: runs checks and stops `PASS`
- if review-to-fix is `PROCEED`: runs checks and stops `PASS`
- if review-to-fix is `FIX_REQUIRED`: runs bounded fix/reviewer retry cycles up to `--max-fix-attempts`
- each retry can run post-fix review-to-fix planning before the next attempt when reviewer still fails
- `--max-fix-attempts=0` stops immediately on `FIX_REQUIRED` with no fix execution
- terminal statuses include: `PASS`, `NEEDS_FIX`, `NEEDS_FIX_WRITE_DISABLED`, `MAX_FIX_ATTEMPTS_REACHED`, `CHECKS_FAILED`, `FAILED`
- no auto-commit/push/merge

Projection mode:

```bash
npm run agent -- run stage-01 --config configs/my-app.json --auto-chain --dry-run
```

Dry-run behavior:

- validates config loading and stage name
- prints projected auto-chain flow
- does not execute Codex
- does not run checks
- does not mutate workspace/git state

`--max-fix-attempts <n>` is accepted only with `--auto-chain` and must be an integer `0..5` (default `1`).
In Stage E execution, `--max-fix-attempts` is actively enforced as the hard upper bound for fix attempts.

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

Because orchestration does not perform git mutation actions automatically:

- commit orchestrator config/stage/doc updates as needed
- commit target-repo code changes manually (outside orchestrator automation)
- push manually

No auto-commit/push behavior is provided by this tool.
