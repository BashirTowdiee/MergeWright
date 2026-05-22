# Contributing to MergeWright

MergeWright is a delivery harness for controlled AI-assisted engineering workflows. Contributions should preserve the project focus on evidence-first, human-gated, auditable delivery.

## Before you start

1. Check existing issues, pull requests, and roadmap docs before opening a new change.
2. Prefer small, reviewable slices over broad rewrites.
3. Keep documentation, tests, and safety behaviour aligned with the implementation.
4. Avoid changing generated artefacts unless the change explicitly requires it.

## Development setup

Install dependencies and build the project:

```bash
npm install
npm run build
```

Run tests:

```bash
npm test
```

Check the CLI locally:

```bash
npm run mergewright -- --help
```

## Contribution expectations

Every implementation PR should include:

- a clear summary of the change
- the reason the change is needed
- tests for new or changed behaviour
- notes about safety, write-safety, or orchestration impact
- documentation updates when behaviour or commands change

## Architecture rules

MergeWright should remain service-first and evidence-first.

Do not add code paths that:

- bypass write-safety checks
- let UI layers shell out directly
- make the TUI parse CLI stdout
- duplicate orchestration logic across CLI, TUI, MCP, or future web UI surfaces
- mark work as accepted without required evidence
- hide AI-generated changes from review

For TUI write-capability work, use the dedicated roadmap in `docs/plans/tui-write-capability-roadmap.md`.

## Pull request checklist

Before opening or marking a PR ready:

- [ ] The change is scoped to one clear slice.
- [ ] Tests pass locally, or the blocker is documented.
- [ ] New behaviour is covered by tests.
- [ ] Docs are updated when user-facing behaviour changes.
- [ ] Safety and write-safety implications are called out.
- [ ] The PR body explains any known trade-offs.

## Review expectations

Reviews should focus on:

- regressions
- missing tests
- unsafe assumptions
- architecture drift
- dependency mistakes
- unclear evidence or acceptance criteria

A reviewer should request changes when a PR bypasses documented safety boundaries, relies on parsing CLI stdout from UI-facing code, or introduces untested orchestration behaviour.

## Reporting security issues

Do not open public issues for secrets, token handling, sandbox escapes, unsafe write paths, or other security-sensitive concerns. Use the security reporting path documented in `SECURITY.md` once available. Until then, contact the repository owner directly.
