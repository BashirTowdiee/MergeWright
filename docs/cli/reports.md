# Report Commands

## report-run

```bash
npm run agent -- report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]
```

Options behavior:

- default writes `run-report.md` and `run-report.json`
- `--pr-summary` also writes `pr-summary.md`
- `--stdout-only` prints output without writing files
- `--json` prints JSON-only output
- `--json --pr-summary --stdout-only` is rejected

`run` and `continue-run` support `--generate-report` to produce reports after completion.

## prove

```bash
npm run agent -- prove <run-id> --config <config-path> [--json] [--verbose]
```

Behavior:

- computes readiness from the existing report pipeline without writing artefacts
- exits `0` only when status is `READY`
- exits non-zero for `NEEDS_REVIEW`, `NEEDS_FIX`, and `BLOCKED`
- `--json` prints a machine-readable proof wrapper with the embedded `report`

## compare-runs

```bash
npm run agent -- compare-runs <run-id-a> <run-id-b> --config <config-path> [--json] [--verbose]
```

Behavior:

- compares readiness status, score/risk, checks state, reviewer verdict, changed files, and acceptance outcomes
- compares failed-check deltas and changed-file set deltas
- keeps missing evidence explicit for each run
- read-only: no Codex execution, no checks execution, and no artefact writes
- `--json` prints a machine-readable comparison payload
