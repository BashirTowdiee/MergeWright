# Production Readiness

## Purpose

This document defines what should be reviewed before MergeWright is considered production-ready for external users.

## Product readiness

- Product positioning is clear.
- README explains the problem, usage, and safety model.
- Core workflows are documented.
- Limitations are explicit.
- Examples are current.

## Engineering readiness

- Build passes consistently.
- Test suite covers critical workflows.
- Safety-critical paths have regression coverage.
- Run metadata is stable enough for consumers.
- Error messages are actionable.
- Artefact paths and formats are predictable.

## Safety readiness

- Read-only defaults are preserved.
- Write mode is explicit.
- Write mode is gated by safety checks.
- Planner and reviewer remain read-only.
- Post-write review is enforced.
- Checks are blocked when required review has not passed.
- No auto-push or auto-merge exists without explicit future design.

## Operational readiness

- Installation instructions are clear.
- Required external tools are documented.
- Environment variables are documented.
- Failure modes are documented.
- Run directories can be inspected manually.

## Release readiness

- Changelog or release notes exist.
- Migration notes exist where required.
- Known issues are documented.
- Versioning strategy is clear.

## Future GUI/API readiness

Before shipping a GUI/API surface:

- Local API is documented.
- API actions use the same orchestration core as CLI.
- Dashboard does not bypass safety gates.
- Event stream payloads are stable.
- UI exposes failed and blocked states clearly.
- Review/fix/continue actions are explicit.

## Production readiness decision

A release is ready when the product can be installed, run, inspected, and recovered from common failure states without relying on hidden knowledge from the maintainer.
