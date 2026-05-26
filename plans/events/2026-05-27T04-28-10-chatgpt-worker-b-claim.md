# Worker claim

worker-id: chatgpt-worker-b

timestamp: 2026-05-27T04:28:10+10:00

selected action: Fix PR 255 CI blocker only.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: existing CLI behaviour remains compatible for documented commands during the migration, with the root CLI shim reduced to a compatibility boundary.

intended branch: agent/chatgpt-worker-b/cli-runtime-shim

PR number: 255

files/directories likely to be touched:
- test/cli-app-boundary.test.ts
- plans/workers/chatgpt-worker-b.md
- plans/coordination.md

notes:
- The failing CI step is Test CLI.
- The narrow blocker is the regression test expecting the old root `src/cli.ts` implementation shape after PR 255 intentionally reduced it to a shim.
