# Claim

worker-id: chatgpt-worker-b

timestamp: 2026-05-27T15:37:00+10:00

selected action: Implement the next non-overlapping Stage 3.5 adapters package boundary slice.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion:
- `packages/adapters` exposes process-bound integrations through an explicit package boundary.
- Adapter package boundary coverage prevents the boundary from regressing to a placeholder or dropping exported adapter modules.
- Existing CLI behaviour remains compatible during migration.

intended branch: agent/chatgpt-worker-b/adapters-package-boundary

PR number: pending

files/directories likely to be touched:
- packages/adapters/src/index.ts
- test/adapters-package-boundary.test.ts
- plans/events/2026-05-27T15-37-00-chatgpt-worker-b-claim.md
- plans/workers/chatgpt-worker-b.md

conflicting claims considered:
- Open PR search returned no open PRs.
- Fresh worker-b config/domain claims are completed by merged PRs #264 and #266.
- Recent worker-a CLI-runtime claims are completed by merged PRs and do not overlap this adapter package boundary test slice.

status: CLAIMED
