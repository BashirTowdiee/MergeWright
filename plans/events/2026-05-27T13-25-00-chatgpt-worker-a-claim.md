# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T13:25:00+10:00

selected action: Implement the next meaningful Stage 3.5 vertical slice by moving the CLI app's direct `child_process` open-run-directory integration into the adapters package.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: orchestration logic, workspace mutation logic, provider execution, GitHub logic, config loading, and risk policy do not live in CLI presentation code; CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping; packages/adapters owns process-bound integrations.

intended branch: agent/chatgpt-worker-a/extract-open-run-directory-adapter

PR number: pending

files/directories likely to be touched:
- apps/cli/src/main.ts
- packages/adapters/src/open-run-directory.ts
- packages/adapters/src/index.ts
- test/cli-app-boundary.test.ts
- test/workspace-skeleton.test.ts
- plans/events/2026-05-27T13-25-00-chatgpt-worker-a-claim.md
- plans/workers/chatgpt-worker-a.md

collision check before claim:
- Open PR scan returned no open PRs.
- PR 258 and PR 259 are merged.
- Recent active Stage 3.5 work focused on `src/cli-core.ts`, `src/cli/run-command.ts`, and `src/cli/dispatch.ts`; this slice avoids those files.
- Older worker-b root CLI compatibility notes are stale and merged/superseded by later PRs.
- Older worker-c/d package-lock blocker notes refer to merged PR 241-era work and no longer have an open PR.
