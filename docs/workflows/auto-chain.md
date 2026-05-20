# Auto-Chain

`run --auto-chain` executes planner -> builder -> reviewer -> review-to-fix with bounded fix loops.

Terminal statuses:

- `PASS`
- `NEEDS_FIX`
- `NEEDS_FIX_WRITE_DISABLED`
- `MAX_FIX_ATTEMPTS_REACHED`
- `CHECKS_FAILED`
- `FAILED`

Safety boundaries:

- `--max-fix-attempts` hard bounded to `0..5`
- no auto-commit
- no auto-push
- no auto-accept
