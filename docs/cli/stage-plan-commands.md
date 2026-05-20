# Stage Plan Commands

## import-stage-plan

```bash
npm run agent -- import-stage-plan --from <path> --out <path> [--force]
```

## run-stage

```bash
npm run agent -- run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]
```

## run-stages

```bash
npm run agent -- run-stages --stage-plan <path> --config <config-path> --stop-after-each-stage [--allow-writes] [--dry-run] [--verbose] [--stream-codex]
```

## continue-stages

```bash
npm run agent -- continue-stages --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]
```

## accept-stage

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path> [--auto-commit] [--commit-message <text>]
```

## fix-stage

```bash
npm run agent -- fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--reassess-downstream] [--allow-writes] [--verbose] [--stream-codex]
```

## reassess-stage-plan

```bash
npm run agent -- reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]
```

Notes:

- `--auto-commit` is rejected by `run-stage`, `run-stages`, and `continue-stages`
- one stage is run per invocation
