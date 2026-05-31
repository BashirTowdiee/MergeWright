# Web + API Quickstart

This guide runs the current web-first operator stack locally:

- `apps/api`: Fastify API over MergeWright application services and CLI-equivalent workflows
- `apps/web`: browser control room that reads runs and executes CLI-equivalent commands via API

The reference UX guide for this slice is:

- `docs/ux/web-app-demo.html`
- `docs/ux/04-web-interface-implementation-plan.md`

## 1) Build

```bash
npm run build
```

## 2) Start API

```bash
npm run start --workspace @mergewright/api -- --config config.example.json --host 127.0.0.1 --port 3040
```

API routes used by the web app:

- `GET /health`
- `GET /projects`
- `GET /projects/:projectId`
- `GET /projects/:projectId/health`
- `GET /reviews`
- `POST /reviews/:reviewId/comments`
- `POST /reviews/:reviewId/approval`
- `GET /providers`
- `GET /policy`
- `GET /safety/write-status`
- `GET /settings`
- `PUT /settings`
- `GET /runs`
- `GET /runs/compare?runA=<id>&runB=<id>`
- `GET /runs/:runId`
- `GET /runs/:runId/readiness`
- `GET /runs/:runId/review`
- `GET /runs/:runId/evidence`
- `GET /runs/:runId/phase-artifacts`
- `GET /runs/:runId/events?limit=<n>`
- `GET /runs/:runId/artifacts`
- `GET /runs/:runId/artifacts/:artifactId/content`
- `GET /stage-plans`
- `GET /stage-plans/:stagePlanId`
- `GET /cli/events` (SSE command lifecycle stream)
- `GET /cli/events/recent?limit=<n>` (recent command lifecycle history)
- `POST /commands` (typed app commands)
- `POST /commands/preview` (typed command description/risk preview)
- `POST /cli/commands` (CLI-equivalent command gateway)
- `POST /cli/commands/preview` (CLI-equivalent preview contract)
- `GET /commands/:commandId/events?limit=<n>` (request-scoped lifecycle history)

## 3) Start web app

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3040 npm run dev --workspace @mergewright/web
```

Open:

- `http://127.0.0.1:3050`

The web app calls the API directly using `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:3040`).

## 4) Validate basic flow

1. Project overview loads from `GET /api/projects` and `GET /api/projects/:projectId/health`.
2. Run list loads from `GET /api/runs`.
3. Selecting a run loads detail from `GET /api/runs/:runId`.
4. Results/review/evidence panels load from `GET /api/runs/:runId/readiness`, `GET /api/runs/:runId/review`, and `GET /api/runs/:runId/evidence`.
5. Run detail artifacts load from `GET /api/runs/:runId/artifacts`.
6. Artifact preview loads from `GET /api/runs/:runId/artifacts/:artifactId/content`.
7. Stage plan list/detail load from `GET /api/stage-plans` and `GET /api/stage-plans/:stagePlanId`.
8. Command launcher posts to `POST /api/cli/commands`.
9. Command typed result + CLI summary lines render in the UI.
10. Sidebar API health shows `healthy` when `GET /api/health` succeeds.
11. Command execution mode supports `preview-first`, `read-only`, and `write-enabled with confirmation`.
12. Settings page loads persisted settings and policy snapshots from `GET /api/settings`, `GET /api/providers`, `GET /api/policy`, and `GET /api/safety/write-status`.
13. Saving settings writes to `PUT /api/settings` and updates command defaults in the command launcher.
14. Events tab loads run-scoped lifecycle history from `GET /api/runs/:runId/events?limit=<n>` and receives live updates from `/api/cli/events`.
15. Compare runs page loads score/risk/check/reviewer/file deltas from `GET /api/runs/compare?runA=<id>&runB=<id>`.
16. Phase cards in run detail scope artifacts through `GET /api/runs/:runId/phase-artifacts`.
17. Team review queue/comments/approval flow use `GET /api/reviews`, `POST /api/reviews/:reviewId/comments`, and `POST /api/reviews/:reviewId/approval`.
18. Team review PR summary preview and audit trail load via `GET /api/runs/:runId/artifacts`, `GET /api/runs/:runId/artifacts/:artifactId/content`, and `GET /api/runs/:runId/events?limit=<n>`.

## Notes

- `start-run`, `continue-run`, and `execute-builder` via `POST /commands` are wired to core run/continue workflows with API-safe defaults.
- The CLI gateway endpoint provides web command coverage for `run`, `continue-run`, `prove`, `report-run`, `compare-runs`, `review-modes`, `check-write-safety`, `probe-opencode`, `run-stage`, `run-stages`, `continue-stages`, `accept-stage`, `fix-stage`, and `reassess-stage-plan`.
- Current web app is a runnable demo-guided control room slice; it is intentionally lightweight and does not yet cover the entire `web-app-demo.html` surface.
