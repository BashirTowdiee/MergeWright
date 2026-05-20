# First Run

Use a read-only preview first.

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset full-readonly --dry-run
```

Then run selected phases.

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --execute-planner --execute-builder --execute-reviewer
```

Inspect output:

```bash
npm run agent -- list-runs --config configs/my-app.json
npm run agent -- show-run <run-id> --config configs/my-app.json
```
