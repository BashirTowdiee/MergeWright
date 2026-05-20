# Workflow Selection

Use Classic run when:

- you have one focused stage file
- you want phase-level control (`run`, `continue-run`)
- you want bounded auto-chain retries

Use Stage Plan when:

- work should be split into multiple reviewable stages
- each stage needs explicit accept/fix decisions
- downstream stages may require reassessment after revisions

Related:

- [../workflows/classic-run.md](../workflows/classic-run.md)
- [../workflows/stage-plan.md](../workflows/stage-plan.md)
