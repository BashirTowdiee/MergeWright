# Reassessment

Use `reassess-stage-plan` to classify downstream stages after a source-stage revision.

Classifications:

- `unchanged`
- `needs_revision`
- `invalidated`

`needs_revision` and `invalidated` block `continue-stages` until the plan is updated manually or replaced.
