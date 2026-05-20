# Fixing Stages

Use `fix-stage` for a stage in need of revision before acceptance.

```bash
npm run agent -- fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--reassess-downstream] [--allow-writes]
```

Key rules:

- feedback is required
- committed stages are rejected
- successful fix increments revision and returns stage to `review_required`
