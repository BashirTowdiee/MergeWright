# Release Plan

## Purpose

This document defines how MergeWright should move from local development to a reviewable release.

## Release goals

- Preserve CLI stability.
- Make release contents clear.
- Keep safety behaviour explicit.
- Avoid shipping partially documented workflow changes.
- Provide enough information for users to upgrade safely.

## Release readiness checklist

Before release:

- Build passes.
- Test suite passes.
- README reflects current behaviour.
- Product docs reflect current direction.
- Safety model is documented.
- Breaking changes are documented.
- Example commands are valid.
- Known limitations are listed.

## Release types

### Documentation release

Used when only documentation changes are made.

Requirements:

- Markdown is reviewed.
- Links and examples are checked where practical.

### CLI feature release

Used when new CLI behaviour is added.

Requirements:

- Build passes.
- Tests cover new behaviour.
- README or command help is updated.
- Safety impact is reviewed.

### Safety release

Used when write-safety, review gates, or execution controls change.

Requirements:

- Dedicated regression tests.
- Explicit safety review.
- Clear migration notes if behaviour changes.

### GUI/API release, future

Used once local API or dashboard surfaces exist.

Requirements:

- API contract tests.
- UI smoke tests.
- Local startup validation.
- CLI compatibility check.

## Versioning

Recommended approach:

- Use semantic versioning once published externally.
- Before external publishing, use milestone labels or tagged internal releases.

## Release notes structure

```md
# Release X.Y.Z

## Summary

## Added

## Changed

## Fixed

## Safety impact

## Migration notes

## Known limitations
```

## Rollback plan

For local CLI releases, rollback means returning to the previous git tag or npm version.

For future GUI/API releases, rollback should also cover local state compatibility if run metadata schemas change.
