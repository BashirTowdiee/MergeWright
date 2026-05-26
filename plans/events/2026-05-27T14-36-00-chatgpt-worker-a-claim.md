# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T14:36:00+10:00

selected action: Implement the next meaningful Stage 3.5 vertical slice by making the CLI app runtime import focused CLI modules directly instead of routing through the root compatibility facade.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion:
- CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping.
- Existing CLI behaviour remains compatible for documented commands during the migration.
- Root `src/cli-core.ts` remains a temporary compatibility facade while the app entrypoint moves off that facade.

intended branch: agent/chatgpt-worker-a/cli-app-runtime-direct-imports

PR number: pending

files/directories likely to be touched:
- apps/cli/src/runtime.ts
- test/cli-app-boundary.test.ts
- plans/events/2026-05-27T14-36-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md

conflicting claims considered:
- No open PRs were found.
- Worker-b has a fresh blocked-write event for `packages/config/src/index.ts` and `test/config-package-boundary.test.ts`; this slice avoids those files.
- Worker-c and worker-d PR 241 notes are stale because no open PR remains.

status: CLAIMED
