# Command Reference (v1)

## Top-Level Help

Purpose: show command list, safety defaults, and high-level usage.

```bash
npm run agent -- --help
```

Also supported:

```bash
npm run agent -- <command> --help
```

## Presets

Supported run presets:

- `plan`
- `build`
- `review`
- `fix-plan`
- `full-readonly`

Preset behavior:

- expands phase flags for `run`
- can be combined with explicit phase flags
- not supported by `continue-run`

## `init-project`

Purpose: create orchestrator-side config/stage/runs scaffolding for a target repo.

Usage:

```bash
npm run agent -- init-project <name> --workspace <path> [--force] [--verbose]
```

Required args:

- `<name>` project display name
- `--workspace <path>` target repo path (validation target)

Common flags:

- `--force` overwrite generated orchestrator files
- `--verbose` print detailed init writes

Example:

```bash
npm run agent -- init-project "My App" --workspace /path/to/repo
```

Notes:

- does not write into target workspace
- does not require `--config`

## `run`

Purpose: create a new run directory and execute selected phases (or dry-run them).

Usage:

```bash
npm run agent -- run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]
```

Required args:

- `<stage-name>` stage file name without `.md`
- `--config <config-path>` config path (no implicit default)

Common flags:

- `--repo <path>` override `workspaceRoot` from config
- `--preset <name>` preset expansion
- `--execute-planner`
- `--execute-builder` (requires planner)
- `--execute-reviewer` (requires planner)
- `--plan-fix` (requires reviewer)
- `--execute-fix` (requires fix-plan)
- `--run-checks`
- `--allow-writes` (builder/fix only, requires write safety pass)
- `--auto-chain` (bounded auto-chain execution)
- `--max-fix-attempts <number>` (`--auto-chain` only; integer `0..5`, default `1`)
- `--dry-run`
- `--verbose`
- `--stream-codex` (stream raw Codex stdout/stderr live; artefacts still captured)
- `--plan-html` (write `plan.html` visualisation into run directory)
- `--open-plan` (implies `--plan-html`; attempts browser open, safely skipped in CI/non-interactive environments)
- `--generate-report` (generate `run-report.md` and `run-report.json` after successful command completion)

Examples:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --preset full-readonly --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --execute-planner --execute-builder
npm run agent -- run stage-01-example --config configs/my-app.json --auto-chain --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --auto-chain
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run --generate-report
```

Notes:

- creates `runs/<project>/<run-id>/`
- with `--plan-html`, also creates `runs/<project>/<run-id>/plan.html` (visualisation only; canonical plan remains Markdown/JSON artefacts)
- `--dry-run` skips Codex and checks execution while recording skipped/dry-run artifacts
- with `--generate-report`, report artefacts are generated after the run summary
- `--generate-report` writes or refreshes `run-report.md` and `run-report.json` only after a successful `run` (including successful `run --auto-chain`)
- if the primary `run` command fails, automatic report generation is skipped so the original failure remains clear
- if a run directory exists after failure, generate the report manually with `report-run <run-id> --config <config-path>`
- automatic report generation overwrites existing `run-report.md` and `run-report.json` in the run directory
- automatic report generation does not execute Codex, does not run checks, does not run git commands, and does not mutate the target workspace
- prints live phase progress to terminal while running
- default mode does not stream full Codex stdout/stderr to terminal (see run artefacts instead)
- `--stream-codex` enables live raw Codex stdout/stderr streaming while preserving run artefacts
- `--auto-chain` is supported only for `run` (not `continue-run`)
- `--auto-chain` runs an initial pass: planner -> builder -> reviewer -> review-to-fix
- if reviewer is `PASS`, checks run and final status is `PASS`
- if review-to-fix decision is `PROCEED`, checks run and final status is `PASS`
- if review-to-fix decision is `FIX_REQUIRED`, auto-chain runs fix/reviewer retries up to `--max-fix-attempts`
- retries are bounded; no retry loop can exceed configured `--max-fix-attempts` (hard bounded to `0..5`)
- `--max-fix-attempts=0` means stop immediately on `FIX_REQUIRED` with `MAX_FIX_ATTEMPTS_REACHED` and no fix execution
- terminal statuses include `PASS`, `NEEDS_FIX`, `NEEDS_FIX_WRITE_DISABLED`, `MAX_FIX_ATTEMPTS_REACHED`, `CHECKS_FAILED`, `FAILED`
- checks failures produce `CHECKS_FAILED`
- fix attempts require `--allow-writes`; without writes, `FIX_REQUIRED` returns `NEEDS_FIX_WRITE_DISABLED`
- reviewer and review-to-fix phases remain read-only; workspace-write is used only for fix execution when `--allow-writes` is enabled and write safety passes
- `--auto-chain` rejects `--preset` and explicit phase flags (`--execute-planner`, `--execute-builder`, `--execute-reviewer`, `--plan-fix`, `--execute-fix`, `--run-checks`)
- `--auto-chain --dry-run` remains projection-only
- `--auto-chain --dry-run --generate-report` prints a skip note because projection mode does not create a run directory
- `--max-fix-attempts` is actively used by Stage E execution as the bounded retry limit
- `--stream-codex` streams live Codex output during auto-chain while artefact capture remains unchanged
- `--verbose` increases orchestrator progress/detail logging; it does not imply `--stream-codex`

## `continue-run`

Purpose: resume selected phases in an existing run directory.

Usage:

```bash
npm run agent -- continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]
```

Required args:

- `<run-id>` existing run id
- `--config <config-path>` config path

Common flags:

- `--execute-builder`
- `--execute-reviewer`
- `--plan-fix`
- `--execute-fix`
- `--run-checks`
- `--allow-writes` (builder/fix only, requires write safety pass)
- `--dry-run`
- `--verbose`
- `--stream-codex` (stream raw Codex stdout/stderr live; artefacts still captured)
- `--plan-html` (write `plan.html` visualisation into run directory)
- `--open-plan` (implies `--plan-html`; attempts browser open, safely skipped in CI/non-interactive environments)
- `--generate-report` (regenerate `run-report.md` and `run-report.json` after successful command completion)

Examples:

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer --plan-fix
npm run agent -- continue-run <run-id> --config configs/my-app.json --run-checks
npm run agent -- continue-run <run-id> --config configs/my-app.json --run-checks --generate-report
```

Notes:

- requires at least one continuation phase flag
- `--execute-planner` is not supported
- `--preset` is not supported
- prints live continuation phase progress to terminal while running
- default mode stays concise; use `--stream-codex` to watch Codex output live
- with `--generate-report`, report artefacts are regenerated after the continuation summary
- if the primary `continue-run` command fails, automatic report generation is skipped so the original failure remains clear
- if a run directory exists after failure, generate the report manually with `report-run <run-id> --config <config-path>`
- automatic report generation overwrites existing `run-report.md` and `run-report.json` in the run directory
- automatic report generation does not execute Codex, does not run checks, does not run git commands, and does not mutate the target workspace

## `list-runs`

Purpose: list runs and summarized statuses for a project.

Usage:

```bash
npm run agent -- list-runs --config <config-path>
```

Required args:

- `--config <config-path>`

Example:

```bash
npm run agent -- list-runs --config configs/my-app.json
```

Notes:

- reads from configured runs root
- uses `run.json` metadata when valid

## `show-run`

Purpose: display detailed metadata, phase statuses, and artefact listing for a run.

Usage:

```bash
npm run agent -- show-run <run-id> --config <config-path>
```

Required args:

- `<run-id>`
- `--config <config-path>`

Example:

```bash
npm run agent -- show-run <run-id> --config configs/my-app.json
```

Notes:

- shows warnings if metadata is malformed
- falls back to artefact inference when needed

## `open-run`

Purpose: open run directory for inspection (macOS helper).

Usage:

```bash
npm run agent -- open-run <run-id> --config <config-path>
```

Required args:

- `<run-id>`
- `--config <config-path>`

Example:

```bash
npm run agent -- open-run <run-id> --config configs/my-app.json
```

Notes:

- on non-macOS platforms, prints run directory path instead

## `report-run`

Purpose: generate AI Change Report artefacts for an existing run directory.

Usage:

```bash
npm run agent -- report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]
```

Required args:

- `<run-id>`
- `--config <config-path>`

Common flags:

- `--json` print JSON report to stdout (stdout is JSON-only and suitable for piping to tools)
- `--pr-summary` also generate PR summary Markdown for GitHub body usage
- `--stdout-only` print report output without writing artefacts
- `--force` overwrite existing `run-report.md`, `run-report.json`, and `pr-summary.md`
- `--verbose` print detailed progress context

Examples:

```bash
npm run agent -- report-run <run-id> --config configs/my-app.json
npm run agent -- report-run <run-id> --config configs/my-app.json --pr-summary
npm run agent -- report-run <run-id> --config configs/my-app.json --stdout-only
npm run agent -- report-run <run-id> --config configs/my-app.json --stdout-only --json
npm run agent -- report-run <run-id> --config configs/my-app.json --pr-summary --stdout-only
npm run agent -- report-run <run-id> --config configs/my-app.json --force
```

Notes:

- does not execute Codex
- does not run checks
- does not run git commands
- does not mutate target workspace
- does not create PRs and does not call GitHub APIs
- default writes `run-report.md` and `run-report.json` inside the run directory and prints a human summary
- `--pr-summary` also writes `pr-summary.md`
- `--json` output is JSON-only (no progress logs or human summary on stdout)
- `--stdout-only` prints Markdown by default, or JSON when combined with `--json`
- `--pr-summary --stdout-only` prints PR summary Markdown only
- `--json --pr-summary --stdout-only` is rejected because stdout can contain only one machine-readable format
- reads existing run artefacts only
- optional `changeReport` config is loaded from the project config; when omitted, built-in defaults are used
- risk path rules use simple path matching (exact, prefix for `.../`, or substring), not full glob semantics
- precedence is deterministic: high-risk matches override medium/low, medium overrides low
- hard readiness rules still override score thresholds (for example failed run or failed required review)
- report policy affects reporting only; it does not affect Codex execution, checks execution, or write safety behavior

## `check-write-safety`
Purpose: inspect whether a target repo is ready for a future write-enabled builder/fix run.

Usage:

```bash
npm run agent -- check-write-safety --config <config-path>
```

Required args:

- `--config <config-path>`

Behavior:

- loads and validates config (including `writeSafety`)
- inspects git repo state with read-only git commands only
- reports branch, clean/dirty state, blocked path matches, warnings/failures
- exits non-zero when readiness fails (including `writeSafety.enabled=false`)
- does not execute Codex
- does not run target tests/build
- does not mutate workspace files
- prints live write-safety progress checkpoints before the final summary

## Progress Logging

`run`, `continue-run`, and `check-write-safety` emit live phase-level status by default:

- start / completion / skipped / failure markers
- write-safety and write-audit activity markers
- check execution progress markers
- run artefact location hints

Use `--verbose` to add detail such as config path, model/reasoning/sandbox per Codex phase, and concrete check commands.

## Command-Level Help

Use help per command to verify current options:

```bash
npm run agent -- run --help
npm run agent -- continue-run --help
npm run agent -- list-runs --help
npm run agent -- show-run --help
npm run agent -- open-run --help
npm run agent -- init-project --help
npm run agent -- check-write-safety --help
```
