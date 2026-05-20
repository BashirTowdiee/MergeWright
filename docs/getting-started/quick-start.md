# Quick Start

1. Install dependencies:

```bash
npm install
npm run build
```

2. Inspect CLI help:

```bash
npm run agent -- --help
```

3. Create project scaffolding:

```bash
npm run agent -- init-project "My App" --workspace /path/to/repo
```

4. Run a first read-only classic run:

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
```

5. Choose workflow docs:

- Classic: [../workflows/classic-run.md](../workflows/classic-run.md)
- Stage Plan: [../workflows/stage-plan.md](../workflows/stage-plan.md)
