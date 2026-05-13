# Stage Prompting Guide

This guide explains how to write effective stage files for predictable Planner -> Builder -> Reviewer orchestration.

## Stage File Structure

Recommended sections:

- Goal
- Context
- Files Likely Involved
- Hard Constraints
- Implementation Scope
- Tests
- Validation
- Output Expected

## Recommended Section Content

### Goal

State exactly what should be achieved in this stage, in one or two concrete outcomes.

### Context

Include key architectural/business context the agent needs, but keep it short and relevant.

### Files Likely Involved

List probable file paths or modules. This reduces exploratory drift.

### Hard Constraints

Explicitly list prohibited actions and safety constraints, for example:

- do not change runtime dependencies
- do not modify unrelated modules
- do not add new CLI behavior

### Implementation Scope

Bound the work:

- what must be changed
- what may be changed
- what must not be changed

### Tests

List exact commands or test subsets expected for this stage.

### Validation

Define acceptance checks, such as:

- expected files changed
- expected command output shape
- expected artifact presence

### Output Expected

Specify what the final response/report should include.

## How To Keep Changes Small

- Prefer one clear objective per stage.
- Avoid mixing refactor + feature + docs in one stage.
- Split broad work into ordered stage files.
- Keep acceptance criteria measurable.

## How To Avoid Agent Drift

- Name exact commands and paths.
- State explicit non-goals.
- Require reporting of assumptions.
- Constrain optional enhancements unless requested.

## How To Specify “Do Not Do” Constraints

Use direct negatives, for example:

- Do not modify files outside `docs/`.
- Do not run integration tests.
- Do not execute destructive git commands.
- Do not change existing runtime behavior.

## How To Split Large Work Into Stages

Example split:

1. Stage 01: gather context and produce plan artefacts.
2. Stage 02: implement focused change set A.
3. Stage 03: implement focused change set B.
4. Stage 04: validate and polish docs/tests.

Each stage should be independently reviewable.

## Good Prompt Example

```md
# Goal
Document the run inspection flow for operators.

# Context
The CLI already supports list-runs/show-run/open-run and persists run.json.

# Files Likely Involved
- README.md
- docs/COMMANDS.md
- docs/WORKFLOW.md

# Hard Constraints
- Do not change runtime behavior.
- Do not modify src/*.ts files.

# Implementation Scope
Add missing sections and examples for run inspection and continuation.

# Tests
- npm run build
- npm test

# Validation
- README includes run inspection commands and run.json explanation.
- COMMANDS includes list-runs/show-run/open-run examples.

# Output Expected
Summarize changed files, validation commands, and assumptions.
```

## Bad Prompt Example (Too Broad)

```md
Improve everything about the project and make it production ready.
```

Why this is bad:

- no scope
- no constraints
- no acceptance criteria
- high drift risk

## Reusable Stage Prompt Template

```md
# Goal
<Single concrete outcome>

# Context
<Relevant project background>

# Files Likely Involved
- <path 1>
- <path 2>

# Hard Constraints
- <constraint 1>
- <constraint 2>

# Implementation Scope
- Must do:
  - <item>
- May do:
  - <item>
- Must not do:
  - <item>

# Tests
- <command>
- <command>

# Validation
- <observable acceptance condition>
- <observable acceptance condition>

# Output Expected
- Files changed
- Key decisions
- Validation run summary
- Assumptions
```
