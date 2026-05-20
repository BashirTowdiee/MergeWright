# Safety Utility Commands

## init-project

```bash
npm run agent -- init-project <name> --workspace <path> [--force] [--verbose]
```

## check-write-safety

```bash
npm run agent -- check-write-safety --config <config-path>
```

Notes:

- `check-write-safety` is read-only inspection
- `init-project` writes scaffolding inside orchestrator paths only
