# Auto-Commit

Auto-commit is only supported by:

```bash
npm run agent -- accept-stage <stage-id> --stage-plan <path> --auto-commit
```

Rules:

- explicit opt-in
- no auto-push
- stage must be accepted first
- git must be available
- diff must be non-empty
- scope validation must pass
- commit/SHA failures do not mark stage committed
- committed stages cannot be fixed in-place
