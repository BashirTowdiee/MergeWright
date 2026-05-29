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
