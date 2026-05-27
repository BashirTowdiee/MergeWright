worker-id: chatgpt-worker-a
timestamp: 2026-05-27T23:04:00+10:00
selected action: Add application package export boundary.
active stage: Stage 3.5 Monorepo and CLI boundary refactor.
acceptance criterion: packages/application exposes explicit command, read-model, service, and use-case exports while preserving existing runtime behaviour.
intended branch: agent/chatgpt-worker-a/application-boundary-exports
PR number: none
files/directories likely to be touched:
- packages/application/src/index.ts
- test/application-package-boundary.test.ts
- plans/workers/chatgpt-worker-a.md
