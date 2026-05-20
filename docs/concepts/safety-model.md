# Safety Model

- Read-only is the default execution mode.
- `--allow-writes` is explicit and limited to builder/fix-style execution.
- Write-enabled execution requires write-safety checks and captures write-audit artefacts.
- No auto-push.
- Auto-commit exists only on `accept-stage --auto-commit`.
- Committed stages cannot be fixed in-place.
