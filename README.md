# Standalone Codex CLI Orchestrator

`agent-stage` is a standalone, reusable CLI that orchestrates a controlled Planner -> Builder -> Reviewer workflow (plus fix planning, fix execution prompts, and checks) against a configured target repository.

It is designed for safe, auditable execution with read-only defaults and explicit write mode for builder/fix only.

## What Problem It Solves

When teams run LLM-assisted engineering workflows manually, phase ordering, prompt consistency, and run traceability often break down. This orchestrator standardizes that process:

- enforces phase dependencies
- renders consistent prompts from templates
- stores artefacts and metadata per run
- supports run inspection and continuation
- keeps v1 safety boundaries explicit

## What It Is

- Generic and reusable across projects.
- Target repos are configured through `configs/<project>.json`.
- Stages are task instructions under `stages/<project>/`.
- Runs are stored under `runs/<project>/<run-id>/`.

## Safety Model (Stage T)

- Codex execution is read-only (`-s read-only`) by default.
- `--allow-writes` enables `workspace-write` only for builder/fix, after write-safety passes.
- Write-enabled Codex execution is gated and limited to builder/fix phases only.
- Write-enabled builder/fix runs capture pre/post git audit artefacts under `write-audit/<phase>/`.
- Post-write review gating is required for write-enabled builder/fix:
  - normal `run`: `--allow-writes` with builder/fix requires `--execute-reviewer` in the same command (fail-closed otherwise)
  - `continue-run`: write-enabled builder/fix may run first and leave post-write review as pending until a later reviewer continuation
- Checks ordering is enforced for write-mode flows:
  - write-enabled builder/fix -> write audit -> post-write reviewer completion -> checks
  - checks are blocked while `postWriteReview.status` is pending/failed
- Changed-file audit unions `git diff --name-only` with parsed `git status --porcelain` paths (including untracked/staged-only paths).
- `post-diff.patch` remains tracked `git diff --binary` output; untracked/status-only files are captured in JSON audit artefacts/summary.
- No auto-commit.
- No auto-push.
- No auto-merge.
- `--allow-writes` is supported only for `run` and `continue-run`.
- `writeSafety.enabled` must be `true` and write-safety checks must pass before builder/fix write mode runs.
- Planner/reviewer/review-to-fix always remain read-only, even when `--allow-writes` is set.
- Configured checks are validated against safety rules before execution.
- `--dry-run` is the safest mode to preview behavior.

## Current Limitations

Current v1 does:

- orchestrate planning/review/fix prompts
- capture run artefacts
- run configured checks (when enabled and not dry-run)
- support run inspection and continuation

Current Stage T does not:

- auto-commit
- auto-push
- auto-merge
- run arbitrary unsafe shell commands
- enable write mode for unrelated commands (`list-runs`, `show-run`, `open-run`, `init-project`, `check-write-safety`)

## Quick Start

```bash
npm install
npm run build
npm run agent -- --help
```

## Help Commands

```bash
npm run agent -- --help
npm run agent -- run --help
npm run agent -- continue-run --help
npm run agent -- init-project --help
```

## Project Onboarding

Create orchestrator-side scaffolding for a target repo:

```bash
npm run agent -- init-project "My App" --workspace /path/to/repo
```

This creates:

- `configs/my-app.json`
- `stages/my-app/example-stage.md`
- `runs/my-app/.gitkeep`

`init-project` validates the target workspace path (and git repo requirement), but does not write into the target repo.

Project-specific configs under `configs/*.json` are git-ignored. Use tracked examples like `config.example.json` or `configs/acme.example.json` as templates, then create your local `configs/<project>.json`.

## Running A Stage

Minimal safe preview:

```bash
npm run agent -- run example-stage --config configs/my-app.json --preset plan --dry-run
```

Full v1 read-only pipeline preview:

```bash
npm run agent -- run example-stage --config configs/my-app.json --preset full-readonly --dry-run
```

Live progress output is printed during `run`, `continue-run`, and `check-write-safety`:

- phase starts/completions/failures/skips
- write-safety and write-audit checkpoints
- check execution progress
- run artefact locations (including run directory)

Use `--verbose` to include extra diagnostics (config path, model/reasoning/sandbox details, check command lines, and additional artefact path detail).
Codex stdout/stderr is still captured in run artefacts, but not streamed to terminal by default.
Use `--stream-codex` with `run`/`continue-run` to stream raw Codex stdout/stderr live while preserving all artefact capture.

## Using Presets

Supported presets:

- `plan`
- `build`
- `review`
- `fix-plan`
- `full-readonly`

Presets expand execution flags; you can also add explicit flags.

## Continuing Runs

Continue phases in an existing run directory:

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer
npm run agent -- continue-run <run-id> --config configs/my-app.json --plan-fix
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-fix
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder --allow-writes
npm run agent -- continue-run <run-id> --config configs/my-app.json --run-checks
```

Notes:

- `continue-run` requires at least one continuation phase flag.
- Planner continuation is intentionally unsupported.
- `--preset` is not supported for `continue-run`.

## Inspecting Runs

```bash
npm run agent -- list-runs --config configs/my-app.json
npm run agent -- show-run <run-id> --config configs/my-app.json
npm run agent -- open-run <run-id> --config configs/my-app.json
```

`open-run` is a macOS helper that opens the run directory for inspection.

## Configured Checks

Configured checks come from `commands.checks` in project config.

- checks run only when `--run-checks` is enabled
- checks do not run in `--dry-run`
- check command definitions are safety-validated
- for write-enabled flows, checks run only after post-write review status is `completed`

## Run Artefacts And `run.json`

Each run writes artefacts plus `run.json` metadata.

Typical metadata includes:

- run id, project, stage, config path
- preset and resolved flags
- per-phase status and timestamps
- write-safety and write-audit state (when applicable)
- post-write review state (`required`, `status`, `requiredByPhases`, artefact paths)
- artefact index
- error summary (`status=failed`)

`list-runs` and `show-run` use `run.json` when valid and fall back to artefact inference for older/malformed metadata.

## Recommended Workflow

1. `init-project` once per target repo.
2. Author small, focused stage files.
3. Start with `run ... --preset plan --dry-run`.
4. Use broader presets only after prompt quality is good.
5. Inspect outputs with `show-run`.
6. Continue phases deliberately with `continue-run`.
7. Keep commit/push steps manual in target repo.

## Best Practices

- Keep stage scope small and concrete.
- Use `--dry-run` first for every new stage.
- For write mode: run `check-write-safety`, then run builder/fix with `--allow-writes`, complete reviewer post-write review, run checks, commit manually.
- Write audit artefacts for write-enabled phases are in `write-audit/builder/` and `write-audit/fix/` (`pre-*`, `post-*`, `summary.json`, including `*-untracked-files.json`).
- Post-write review gating artefacts:
  - `post-write-review-required.json`
  - `post-write-review-status.json`
- Prefer presets for repeatable execution intent.
- Treat each run directory as an audit bundle.
- Validate configured checks early.
- Split large work into multiple stage files.

## Troubleshooting

- Missing `--config`: pass explicit `--config <path>`; no implicit default exists.
- Unknown preset: use one of `plan|build|review|fix-plan|full-readonly`.
- Continuation blocked by missing prerequisites: inspect prior phase status in `run.json` and artefacts.
- Malformed `run.json`: `show-run` falls back to artefact inference and prints warnings.
- No checks executed: verify `--run-checks` and ensure `--dry-run` is off.

For deeper references:

- `docs/ARCHITECTURE.md`
- `docs/WORKFLOW.md`
- `docs/PROMPTING.md`
- `docs/OPERATIONS.md`
- `docs/COMMANDS.md`
- `docs/SAFETY.md`
- `docs/WRITE_MODE.md`
- `docs/V1_ACCEPTANCE.md`
- `docs/V2_ACCEPTANCE.md`
