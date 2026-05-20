# Accepting and Committing

Use `accept-stage` after human review of stage artefacts and diff.

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path>
```

Optional explicit auto-commit:

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path> --auto-commit [--commit-message <text>]
```

Auto-commit rules:

- explicit opt-in only
- available only on `accept-stage`
- requires git, non-empty diff, and scope validation
- failed commit/SHA checks do not mark stage committed
