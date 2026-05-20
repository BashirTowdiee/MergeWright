# run

```bash
npm run agent -- run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]
```

Notes:

- presets and explicit phase flags are available
- `--auto-chain` is only supported on `run`
- `--auto-chain` is incompatible with presets and explicit phase flags
- `--allow-writes` requires write-safety pass
