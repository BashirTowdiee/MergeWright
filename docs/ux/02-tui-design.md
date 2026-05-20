# TUI Design

## Status

Accepted product direction. The TUI is the primary human interface for MergeWright.

## Purpose

This document defines the initial design direction for the MergeWright TUI.

The TUI should be a terminal-native control surface for supervising local AI coding workflows. It should not feel like a web dashboard, SaaS console, or CI/CD clone.

## Interface roles

### CLI

The CLI remains the automation surface. It is best for scripts, exact command execution, local CI-style workflows, one-off commands, and debugging command behaviour.

### TUI

The TUI is the primary human interface. It is best for run selection, run inspection, phase flow visibility, artefact browsing, log review, reviewer finding inspection, safe next actions, fix-loop control, and report generation.

### Web, API, and editor surfaces

These are optional future complements after the TUI and application service boundaries prove useful.

## Product feel

The TUI should feel like a local developer cockpit, a repo-aware agent workflow inspector, and a keyboard-first AI coding control plane.

It should feel closer to lazygit, k9s, or lazydocker than a SaaS dashboard.

It should not feel like a generic chat UI, raw terminal log stream, hosted CI/CD dashboard, web admin console, or metrics-heavy SaaS product.

## Primary layout

Initial layout should use three major panes:

- Runs: recent runs for the active project.
- Current run: goal, phase flow, status, changed files, and selected phase.
- Safe action: next safe action, blocked reason, and available commands.

The layout should prioritise:

1. Which run is selected.
2. What the run is trying to do.
3. What phase state exists.
4. What failed or is blocked.
5. What artefacts can be inspected.
6. What action is safe next.

## Core panes

### Run list pane

Shows recent runs for the current project.

Content:

- run title or stage id
- status
- started or completed time
- mode
- branch or workspace where useful

### Current run pane

Shows the selected run.

Content:

- goal or stage summary
- phase flow
- current, failed, or blocked phase
- checks summary
- changed files summary
- report status

### Artefact and detail pane

Shows selected content.

Supported first:

- planner output
- builder output
- reviewer output
- fix output
- logs
- Markdown reports
- JSON metadata
- diff summaries

### Safe action pane

Shows the next safe action derived from run state.

Examples:

- continue run
- request fix
- generate report
- open artefact
- open run folder
- rerun reviewer
- blocked until review passes

## Keyboard model

Suggested shortcuts:

- j/k: move selection
- tab: switch pane
- enter: open selected item
- escape: close modal or go back
- p: planner output
- b: builder output
- r: reviewer output
- f: request or generate fix
- c: continue
- l: logs
- d: diff
- m: metadata
- g: generate report
- o: open artefact in editor
- ?: help
- q: quit

Shortcuts should be discoverable through a help overlay.

## TUI milestones

### Milestone 1: Read-only inspector

- Active project context.
- Recent run list.
- Selected run detail.
- Phase flow.
- Artefact list.
- Artefact preview.
- Safe next action display.

### Milestone 2: Controlled actions

- Continue run.
- Stop run.
- Request fix.
- Generate change report.
- Generate PR summary.
- Open artefact in editor.
- Open run directory.

### Milestone 3: Write-aware workflow

- Write-safety panel.
- Explicit write-mode confirmation.
- Post-write review gate.
- Blocked-state explanation.
- Fix attempt history.
- Review retry history.

## Framework decision

The framework choice is intentionally open.

Candidates:

- Ink
- OpenTUI/Solid
- another framework if a spike proves it better

Decision rule:

Build the same realistic spike in the strongest candidates before committing.

The spike must test pane focus, keyboard shortcuts, phase flow display, artefact preview, scrollable logs, streamed updates, terminal resize, and error states.

## Design principles

- State first, logs second.
- Keyboard-first interaction.
- No hidden risky actions.
- Do not infer safety in the UI if metadata is missing.
- Show blocked reasons explicitly.
- Preserve access to raw artefacts.
- Keep the user in the local repository context.
- Avoid SaaS-style analytics and dashboard metrics unless they directly support safe workflow decisions.
