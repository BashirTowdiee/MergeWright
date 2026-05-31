# Operations Guide (v1)

## Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Run Help

```bash
npm run agent -- --help
npm run agent -- run --help
npm run agent -- continue-run --help
npm run agent -- init-project --help
```

## Common Commands

```bash
npm run agent -- init-project "My App" --workspace /path/to/repo
npm run agent -- run stage-01-example --config .artifacts/projects/my-app/config.json --preset plan --dry-run
npm run agent -- list-runs --config .artifacts/projects/my-app/config.json
npm run agent -- show-run <run-id> --config .artifacts/projects/my-app/config.json
npm run agent -- continue-run <run-id> --config .artifacts/projects/my-app/config.json --execute-reviewer
```

## Project Config

Project configs are runtime-local and default to `.artifacts/projects/<project-id>/config.json` (created by `init-project` or web project init) and define:

- target workspace root
- stages/prompts/runs paths
- codex role model settings
- checks definitions
- safety booleans

No implicit config default exists; always pass `--config`.

## Run Folder Cleanup

Runs accumulate under `.artifacts/runs/<project>/`.

Recommended cleanup approach:

- remove obsolete run directories manually
- keep `.artifacts/runs/<project>/.gitkeep`
- keep any run artefacts needed for audit/debug

## Troubleshoot Failed Runs

1. Run `show-run` for phase status and error summary.
2. Inspect `run.json` for `error.failedPhase` and `resolvedOptions`.
3. Inspect relevant `*-stderr.log`, `*-stdout.log`, and `*-exit.json`.
4. Re-run via `continue-run` only for unresolved phases.

## Recover From Parse Errors

If planner or review-to-fix parsing fails:

- inspect parse error artefacts (`planner-output-parse-error.json` or `review-to-fix-parse-error.json` when present)
- inspect source last-message artefact used for parse
- refine stage constraints and rerun a new stage or continue as appropriate

## Inspect Raw Codex Output

Look in run artefacts for phase logs and message captures:

- `*-stdout.log`
- `*-stderr.log`
- `*-output-last-message.md`
- `*-command*.json`
- `*-exit.json`

## Handle Malformed `run.json`

`list-runs` and `show-run` fall back to legacy artefact inference when `run.json` is missing/malformed.

Recommended response:

- preserve the original run folder
- inspect warnings from `show-run`
- if needed, create a fresh run for a clean metadata baseline

## Configure Checks

Checks are defined in `commands.checks` in project config.

Each check includes:

- `name`
- `command`
- `args`
- `cwd` (`workspace` or `orchestrator`)

Checks run only with `--run-checks` and not in `--dry-run`.

## Keep Generated Runs Out Of Git

Ensure `.gitignore` keeps generated run outputs excluded. Typical pattern:

```gitignore
runs/*
!runs/.gitkeep
```

If using per-project keep files, keep those explicitly and ignore generated run-id folders.
