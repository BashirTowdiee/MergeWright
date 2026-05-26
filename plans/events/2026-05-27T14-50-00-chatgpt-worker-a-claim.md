# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T14:50:00+10:00

selected action: Retry the Stage 3.5 CLI app runtime direct-import slice after the previous connector write failed.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion:
- CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping.
- Existing CLI behaviour remains compatible for documented commands during migration.
- Root `src/cli-core.ts` remains a temporary compatibility facade while the app runtime imports focused CLI modules directly.

intended branch: agent/chatgpt-worker-a/cli-app-runtime-direct-imports

PR number: pending

files/directories likely to be touched:
- apps/cli/src/runtime.ts
- test/cli-app-boundary.test.ts
- plans/events/2026-05-27T14-50-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md

conflicting claims considered:
- Open PR search returned no open PRs.
- Worker-b blocked-write event targets `packages/config/src/index.ts` and `test/config-package-boundary.test.ts`; this retry avoids those files.
- Existing worker-a branch is owned by this worker and contains only planning events so far.

status: CLAIMED
