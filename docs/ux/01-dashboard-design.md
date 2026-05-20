# Dashboard Design

## Status

Proposed UX direction. The dashboard should be implemented after the run state, artefact index, and local API contracts are stable enough to support it.

## Purpose

This document defines the initial UX direction for a future MergeWright local dashboard.

The dashboard should not replace the CLI. It should expose run state, artefacts, review gates, and workflow controls visually.

## Dashboard goals

- Make runs easier to understand.
- Make phase state visible.
- Make artefacts easier to inspect.
- Make review and fix decisions explicit.
- Make auto-chain supervision safer.
- Make change reports easier to consume.
- Reduce manual navigation through run directories.

## Target users

- Maintainer using MergeWright locally.
- Developers running staged AI coding workflows.
- Technical reviewers inspecting AI-generated changes.

## UX positioning

The dashboard should feel like a local CI/CD-style control plane for AI-assisted software changes.

It should not feel like:

- a generic chat UI
- a raw terminal mirror
- a replacement IDE
- a hosted team dashboard

## MVP approach

The first dashboard slice should be read-only over existing run data.

Reasoning:

- It proves visual value quickly.
- It avoids execution and cancellation complexity.
- It validates run metadata and artefact index quality.
- It prevents the UI from bypassing CLI safety semantics.

Execution controls should come after the local API mutation contract is tested.

## Main screens

### Projects screen

Shows configured projects and their target workspaces.

Content:

- Project name.
- Workspace path.
- Config path.
- Last run.
- Current git status, future.

Actions:

- Open project.
- View runs.
- Start run, future.

### Run list

Shows historical runs for a project.

Content:

- Run id.
- Stage.
- Status.
- Started/completed time.
- Mode.
- Final status.
- Provider/model, where available.

Actions:

- Open run.
- Generate report, future.

### Run detail

The primary screen for inspecting a workflow run.

Content:

- Run summary.
- Phase timeline.
- Events/logs.
- Artefact list.
- Changed files summary.
- Review result.
- Checks result.
- Reports.
- Available actions, display-only in MVP.

### Phase timeline

Shows the workflow as ordered phase cards.

Phase card content:

- Phase name.
- Status.
- Started/completed time.
- Provider/model.
- Artefact links.
- Error summary, if failed.
- Blocked reason, if blocked.

### Artefact viewer

Displays human-readable artefacts without leaving the dashboard.

Supported first:

- Markdown.
- Plain text logs.
- JSON metadata.
- Patch/diff files.

### Review gate panel

Shows whether a run can continue and why.

Content:

- Reviewer verdict.
- Safety status.
- Checks status.
- Required next action.
- Blocked reason.

Actions, future:

- Continue.
- Stop.
- Request fix.
- Approve.
- Commit, later future.

### Change report panel

Shows generated change report and PR summary information.

Content:

- Summary.
- Changed files.
- Risk classification.
- Scope drift notes.
- Test/check results.
- PR summary.

## UX states

The dashboard should explicitly represent:

- pending
- running
- passed
- failed
- blocked
- needs review
- needs fix
- checks failed
- stopped
- cancelled

Each state should show the most useful next information rather than requiring users to inspect raw logs first.

## UX principles

- Default view should show status and next action, not raw logs.
- Raw provider output should be available but collapsed by default.
- Failed and blocked states should be visually distinct.
- Risky actions should require explicit user intent.
- Artefacts should be reachable within one or two clicks.
- UI should not invent state that is not present in run metadata.
- UI should show missing metadata clearly rather than silently hiding gaps.

## MVP dashboard scope

Include:

- Project list.
- Run list.
- Run detail.
- Phase timeline.
- Artefact viewer.
- Events/logs panel.
- Review gate display.
- Change report display.

Exclude:

- Starting runs.
- Continuing runs.
- Write-enabled actions.
- Full config editor.
- Provider marketplace.
- Multi-user collaboration.
- Hosted auth.
- Cloud sync.
- Advanced analytics.
- Electron packaging.

## Recommended first vertical slice

1. Start local dashboard.
2. Load existing runs from disk through a local API.
3. Show project list.
4. Show run list.
5. Open run detail.
6. Show phase timeline and artefacts.
7. Show change report if present.

This proves dashboard value without requiring interactive execution first.

## Open questions

- Should the dashboard use React Flow for the phase timeline, or simple ordered cards first?
- Should the local dashboard open automatically from a CLI command?
- Should the dashboard show absolute local file paths, or only relative project/run paths?
- Should execution controls be hidden entirely in MVP, or shown disabled with explanation?
