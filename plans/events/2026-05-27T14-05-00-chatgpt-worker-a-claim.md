# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T14:05:00+10:00

selected action: Implement the next meaningful Stage 3.5 vertical slice by deriving known CLI commands from the command registry instead of maintaining a duplicate command set.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: CLI command registration remains centralised and existing documented CLI behaviour remains compatible during the migration.

intended branch: agent/chatgpt-worker-a/derive-known-commands-from-registry

PR number: pending

files/directories likely to be touched:
- src/cli/known-commands.ts
- test/cli-dispatch.test.ts
- plans/events/2026-05-27T14-05-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md or fallback event

collision check before claim:
- Open PR search returned no open PRs.
- PR #260 and PR #261 are merged.
- Worker-b PR #261 touched src/cli-core.ts, src/cli/output/index.ts, and test/cli-core-boundary.test.ts; this slice avoids those files.
- Older worker-c and worker-d notes refer to stale PR 241-era blocker state and no open PR is currently active.
