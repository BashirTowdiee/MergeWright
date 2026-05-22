# ADR 0003: Readiness policy

Status: Proposed
Date: 2026-05-22

## Context

MergeWright needs one shared way to decide whether a run, stage, or pull request is ready to proceed.

## Decision

Introduce a small policy module that receives structured run evidence and returns a readiness result.

The result should include:

- status
- blocker reasons
- warnings
- missing evidence
- next action

## Consequences

CLI, TUI, repository checks, and future API surfaces can all show the same readiness result instead of each surface reimplementing its own decision logic.

## Follow-up work

- Define the rule configuration shape.
- Add unit tests for the first rules.
- Include policy results in run evidence.
- Render policy blockers in user-facing summaries.
