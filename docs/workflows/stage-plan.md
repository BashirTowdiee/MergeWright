# Stage Plan Workflow

Stage Plan workflow supports multi-stage human-gated delivery.

## Commands in scope

- `import-stage-plan`
- `run-stage`
- `run-stages`
- `continue-stages`
- `accept-stage`
- `fix-stage`
- `reassess-stage-plan`

## Flow

1. Import a canonical plan (`import-stage-plan`).
2. Run one stage (`run-stage` or `run-stages --stop-after-each-stage`).
3. Review artefacts and diff.
4. Accept (`accept-stage`) or fix (`fix-stage`).
5. Reassess downstream stages when source assumptions changed (`reassess-stage-plan` or `fix-stage --reassess-downstream`).
6. Continue only when gates pass (`continue-stages`).
7. Optional explicit commit only after acceptance (`accept-stage --auto-commit`).

## Gates and constraints

- One command runs at most one stage.
- Successful execution stops at `review_required`.
- No auto-accept.
- `run-stage`, `run-stages`, and `continue-stages` reject `--auto-commit`.
- Committed stages cannot be fixed in-place.
