worker-id: chatgpt-worker-b
selected action: 5
active stage: Stage 3.5 Monorepo and CLI boundary refactor
acceptance criterion: API and CLI app workspace manifests expose explicit built JavaScript and type declaration entrypoints while web remains source-only until a runtime entrypoint exists
intended branch: agent/chatgpt-worker-b/app-manifest-entrypoints
PR: none yet
likely files: apps/api/package.json, apps/cli/package.json, test/app-manifest-boundary.test.ts, plans/workers/chatgpt-worker-b.md
timestamp: 2026-05-27T19:05:00+10:00
evidence used: operating contract small-slice and planning rules; roadmap Stage 3.5 app/package boundary criteria; no open PRs; PR 270 merged; apps/api and apps/cli app manifests lack types/exports metadata
collision decision: no open PR or fresh active claim owns apps/api/package.json, apps/cli/package.json, or test/app-manifest-boundary.test.ts
