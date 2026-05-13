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
npm run agent -- run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose]
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
- `--dry-run`
- `--verbose`

Examples:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --preset full-readonly --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --execute-planner --execute-builder
```

Notes:

- creates `runs/<project>/<run-id>/`
- `--dry-run` skips Codex and checks execution while recording skipped/dry-run artifacts

## `continue-run`

Purpose: resume selected phases in an existing run directory.

Usage:

```bash
npm run agent -- continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose]
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

Examples:

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer --plan-fix
npm run agent -- continue-run <run-id> --config configs/my-app.json --run-checks
```

Notes:

- requires at least one continuation phase flag
- `--execute-planner` is not supported
- `--preset` is not supported

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
