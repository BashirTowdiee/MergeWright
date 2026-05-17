# API Design

## Status

Proposed future layer. The API should not be treated as implemented until a local server exists and the endpoints are backed by shared application services.

## Purpose

This document defines the initial local API direction for Shepherds-Staff.

The API is not the current primary surface. It is a future layer that should expose the orchestration core to a local dashboard or editor extension.

## API goals

- Expose structured project, stage, run, phase, artefact, event, and report data.
- Support a local dashboard without requiring it to parse terminal output.
- Preserve all CLI safety rules.
- Enable read-only run inspection first.
- Add mutation controls only when the run state and cancellation semantics are stable.

## API principles

- Local-first.
- No auth for initial local-only development unless remote access is introduced.
- Reuse orchestration application services.
- Do not duplicate CLI logic.
- Expose structured run state and artefacts.
- Support live run events.
- Make risky actions explicit.
- Return available actions from the server rather than requiring UI consumers to infer them.

## Suggested transport

- HTTP JSON for commands and queries.
- Server-Sent Events for live logs and phase state updates.
- WebSocket only if bidirectional streaming becomes necessary.

## MVP API boundary

### API MVP 1: read-only inspection

Purpose: power the first dashboard slice without adding execution risk.

Includes:

```txt
GET /api/projects
GET /api/projects/:projectId
GET /api/projects/:projectId/stages
GET /api/runs
GET /api/runs/:runId
GET /api/runs/:runId/artefacts
GET /api/runs/:runId/artefacts/:artefactId
GET /api/runs/:runId/events
GET /api/runs/:runId/reports
```

Excludes:

- starting runs
- continuing runs
- stopping runs
- write-enabled actions
- commit actions

### API MVP 2: live execution visibility

Adds:

```txt
GET /api/runs/:runId/events/stream
```

### API MVP 3: controlled mutations

Adds after safety/cancellation behaviour is designed:

```txt
POST /api/runs
POST /api/runs/:runId/continue
POST /api/runs/:runId/stop
POST /api/runs/:runId/request-fix
POST /api/runs/:runId/approve
POST /api/runs/:runId/reports/change-report
POST /api/runs/:runId/reports/pr-summary
```

## Suggested endpoints

### Projects

```txt
GET /api/projects
GET /api/projects/:projectId
```

### Stages

```txt
GET /api/projects/:projectId/stages
GET /api/projects/:projectId/stages/:stageId
```

### Runs

```txt
GET /api/runs
POST /api/runs
GET /api/runs/:runId
POST /api/runs/:runId/continue
POST /api/runs/:runId/stop
POST /api/runs/:runId/request-fix
POST /api/runs/:runId/approve
```

### Artefacts

```txt
GET /api/runs/:runId/artefacts
GET /api/runs/:runId/artefacts/:artefactId
```

### Events

```txt
GET /api/runs/:runId/events
GET /api/runs/:runId/events/stream
```

### Reports

```txt
POST /api/runs/:runId/reports/change-report
POST /api/runs/:runId/reports/pr-summary
GET /api/runs/:runId/reports
```

## Request and response principles

- Use stable IDs rather than file paths where practical.
- Return current run state after mutating actions.
- Include explicit status and next available actions.
- Keep raw logs available but not required for normal UI rendering.
- Include blocked reasons when actions are unavailable.
- Avoid exposing absolute paths unless required for local developer workflows.

## Example run detail shape

```json
{
  "schemaVersion": 1,
  "id": "2026-05-17T10-20-30-stage-01",
  "projectId": "shepherds-staff",
  "stageId": "stage-01",
  "status": "running",
  "mode": "auto-chain",
  "allowWrites": true,
  "dryRun": false,
  "provider": "codex",
  "model": "default",
  "phases": [],
  "artefacts": [],
  "reports": [],
  "availableActions": ["stop"],
  "blockedReason": null
}
```

## Error response shape

Suggested error shape:

```json
{
  "error": {
    "code": "RUN_BLOCKED",
    "message": "Run cannot continue until post-write review passes.",
    "details": {
      "runId": "example-run",
      "blockedReason": "post_write_review_pending"
    }
  }
}
```

## Safety actions

Potentially risky actions should be represented explicitly:

- continue
- approve
- request fix
- run write-enabled phase
- generate report
- commit, future

The API should not infer approval from page navigation or passive viewing.

## Local server command

Proposed command:

```bash
npm run agent -- ui
```

Initial behaviour:

- start a local API server
- serve the dashboard, once available
- print local URL
- avoid remote network exposure by default

## Open questions

- Should the local API be started by a new `ui` command or a more explicit `server` command?
- Should the API persist a separate index database, or derive state from run directories?
- Should the API support concurrent runs in MVP?
- Should artefact content be served as text only, or support binary files later?
- Should dashboard mutation endpoints call application services directly or spawn the same command handlers used by CLI?
