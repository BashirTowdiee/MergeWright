# Claim: application package export boundary

worker-id: chatgpt-worker-a

selected action: Implement the next meaningful Stage 3.5 vertical slice by replacing the application package placeholder with an explicit export boundary.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: API and CLI import the same application services rather than duplicating command logic; packages/application exists as an explicit boundary for command services and use cases.

intended branch: agent/chatgpt-worker-a/application-boundary-exports

PR number: none yet

files/directories likely to be touched:
- packages/application/src/index.ts
- plans/events/2026-05-27T04-55-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md
- plans/coordination.md

timestamp: 2026-05-27T04:55:00 Australia/Melbourne
