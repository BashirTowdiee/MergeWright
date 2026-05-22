# ADR 0001: Product positioning

Status: Accepted
Date: 2026-05-22

## Context

MergeWright sits in a crowded space of AI coding agents, code review tools, merge queues, CI systems, and repository automation. The project needs a clear product position so future implementation work does not drift into becoming another general-purpose coding agent or another CI wrapper.

The enterprise roadmap positions MergeWright as an evidence-first merge governance layer for AI-assisted engineering work.

## Decision

MergeWright will position itself as:

> Evidence-first merge governance for AI-assisted engineering teams.

The product should focus on helping teams answer:

> Should this AI-assisted change be trusted to merge, and why?

MergeWright should complement coding agents rather than compete with them. Coding agents produce changes. MergeWright governs the delivery path around those changes through planning, review gates, evidence capture, write-safety, policy checks, and merge-readiness reporting.

## Consequences

This means MergeWright should prioritise:

- evidence packs and run artefacts
- policy-based merge readiness
- human-gated acceptance
- staged planner, builder, reviewer, and fixer workflows
- backend-agnostic execution contracts
- clear audit trails
- repository and pull request integration
- safe UI command boundaries

This also means MergeWright should avoid:

- becoming a general-purpose coding assistant
- hiding implementation details behind vague AI judgement
- marking work as safe without evidence
- duplicating orchestration logic across CLI, TUI, MCP, or future web UI surfaces
- bypassing write-safety for convenience

## Non-goals

MergeWright is not intended to be:

- a replacement for coding agents
- a replacement for CI
- a replacement for merge queues
- a replacement for human review
- a generic agent marketplace

## Follow-up decisions

Future ADRs should cover:

- evidence manifest format
- policy engine design
- command service boundaries
- execution backend contracts
- hosted runner and sandbox model
