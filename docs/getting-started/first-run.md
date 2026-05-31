# First Run

Use a read-only preview first.

```bash
npm run agent -- run stage-01-example --config .artifacts/projects/my-app/config.json --preset full-readonly --dry-run
```

Then run selected phases.

```bash
npm run agent -- run stage-01-example --config .artifacts/projects/my-app/config.json --execute-planner --execute-builder --execute-reviewer
```

Inspect output:

```bash
npm run agent -- list-runs --config .artifacts/projects/my-app/config.json
npm run agent -- show-run <run-id> --config .artifacts/projects/my-app/config.json
```
