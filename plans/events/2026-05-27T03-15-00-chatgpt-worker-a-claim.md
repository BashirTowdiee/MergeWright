# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T03:15:00+10:00

selected action: Add app workspace package build scripts for Stage 3.5.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: app workspace boundaries have package-level build commands that use their local TypeScript configs while preserving root build behaviour.

intended branch: agent/chatgpt-worker-a/app-package-build-scripts

PR number: none

files/directories likely to be touched:
- apps/api/package.json
- apps/cli/package.json
- apps/web/package.json
- test/workspace-skeleton.test.ts
- plans/events/2026-05-27T03-15-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md

collision check before claim:
- Open PR scan returned no open PRs.
- Recent PR 248 was merged; no active continue-run PR remains open.
- This slice intentionally avoids `src/continue-run.ts` and continue-run helper modules.
- Previous package tsconfig slice PR 247 is merged.
