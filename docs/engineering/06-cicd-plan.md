# CI/CD Plan

## Purpose

This document defines the CI/CD direction for Shepherds-Staff.

## CI goals

- Validate TypeScript build health.
- Run automated tests.
- Protect safety-critical logic.
- Keep documentation changes reviewable.
- Prepare for future release automation.

## Recommended CI checks

For pull requests:

```bash
npm ci
npm run build
npm test
```

Optional future checks:

```bash
npm run lint
npm run typecheck
npm run format:check
npm run docs:check
```

## Branch strategy

Recommended lightweight strategy:

- `main` remains stable.
- Feature branches are used for implementation stages.
- Pull requests include generated change reports where useful.
- Large features should be broken into staged PRs.

## Release automation

Future release automation should support:

- Version bump.
- Changelog generation.
- Build verification.
- Test verification.
- Package publish, if distributed through npm.
- GitHub release notes.

## CI artefacts

Potential artefacts:

- Test reports.
- Coverage reports.
- Build logs.
- Generated docs site output, future.

## Safety gates

CI should block merges when:

- Build fails.
- Tests fail.
- Safety-critical regression tests fail.
- Generated artefact schema tests fail.

## Future docs automation

If an Astro docs site is added, CI should validate that Markdown documents compile into the docs site successfully.

Potential command:

```bash
npm run docs:build
```

## Open questions

- Should release publishing use npm?
- Should generated CLI binaries be attached to GitHub releases?
- Should docs deployment use GitHub Pages or another static host?
