# Dashboard Design

## Purpose

This document defines the initial UX direction for a future Shepherds-Staff local dashboard.

The dashboard should not replace the CLI. It should expose run state, artefacts, review gates, and workflow controls visually.

## Dashboard goals

- Make runs easier to understand.
- Make phase state visible.
- Make artefacts easier to inspect.
- Make review and fix decisions explicit.
- Make auto-chain supervision safer.
- Make change reports easier to consume.

## Target users

- Maintainer using Shepherds-Staff locally.
- Developers running staged AI coding workflows.
- Technical reviewers inspecting AI-generated changes.

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
- Start run.
- View runs.

### Run list

Shows historical runs for a project.

Content:

- Run id.
- Stage.
- Status.
- Started/completed time.
- Mode.
- Final status.

Actions:

- Open run.
- Generate report, where valid.

### Run detail

The primary screen for inspecting a workflow run.

Content:

- Run summary.
- Phase timeline.
- Live events/logs.
- Artefact list.
- Changed files summary.
- Review result.
- Checks result.
- Reports.
- Available actions.

### Phase timeline

Shows the workflow as ordered phase cards.

Phase card content:

- Phase name.
- Status.
- Started/completed time.
- Provider/model.
- Artefact links.
- Error summary, if failed.

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

Actions:

- Continue.
- Stop.
- Request fix.
- Approve, future.
- Commit, future.

### Change report panel

Shows generated change report and PR summary information.

Content:

- Summary.
- Changed files.
- Risk classification.
- Scope drift notes.
- Test/check results.
- PR summary.

## UX principles

- Default view should show status and next action, not raw logs.
- Raw provider output should be available but collapsed by default.
- Failed and blocked states should be visually distinct.
- Risky actions should require explicit user intent.
- Artefacts should be reachable within one or two clicks.

## MVP dashboard scope

Include:

- Run list.
- Run detail.
- Phase timeline.
- Artefact viewer.
- Live events.
- Review gate display.
- Change report display.

Exclude:

- Full config editor.
- Provider marketplace.
- Multi-user collaboration.
- Hosted auth.
- Cloud sync.
- Advanced analytics.
- Electron packaging.

## Recommended first vertical slice

1. Start local dashboard.
2. Load existing runs from disk.
3. Show run list.
4. Open run detail.
5. Show phase timeline and artefacts.
6. Show change report if present.

This proves dashboard value without requiring interactive execution first.
