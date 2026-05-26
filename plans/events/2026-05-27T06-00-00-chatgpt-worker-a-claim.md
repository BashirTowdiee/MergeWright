# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T06:00:00+10:00

selected action: Add package-level TypeScript config skeletons.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: package-level TypeScript build configuration exists for package workspace boundaries while preserving current root build behaviour.

intended branch: agent/chatgpt-worker-a/package-tsconfig-skeletons

PR number: none

files/directories likely to be touched:
- packages/application/tsconfig.json
- packages/domain/tsconfig.json
- packages/adapters/tsconfig.json
- packages/config/tsconfig.json
- packages/shared/tsconfig.json
- test/workspace-skeleton.test.ts
- plans/events/2026-05-27T06-00-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md

collision check before claim:
- Open PR scan returned no open PRs.
- PR 251 is merged.
- Worker-b package build config claim is older than 90 minutes and has no open PR, so it is stale.
- This slice avoids continuation and workflow files.
