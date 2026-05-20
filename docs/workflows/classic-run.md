# Classic Run Workflow

Classic run is for single-stage execution with `run` and `continue-run`.

## Commands in scope

- `run`
- `continue-run`
- `list-runs`, `show-run`, `open-run`
- `report-run`

## Typical flow

1. Run planner-only or preset preview (`--dry-run` optional).
2. Execute planner/builder/reviewer phases.
3. Optionally plan/execute fix phases.
4. Optionally run checks.
5. Generate run report.

## Presets and phase flags

`run` supports presets and explicit phase flags. `continue-run` supports phase flags only.

## Auto-chain

`run --auto-chain` provides bounded fix/reviewer retries controlled by `--max-fix-attempts` (`0..5`).

- Available only on `run`.
- Incompatible with presets and explicit phase flags.
- Does not auto-commit, auto-push, auto-merge, or auto-accept.

## Artefacts

Generated under `runs/<project>/<run-id>/`, including:

- rendered prompts
- per-phase command/stdout/stderr/exit artefacts
- parse and decision artefacts
- checks artefacts
- `run.json`
- optional `run-report.md` / `run-report.json` and `pr-summary.md`
