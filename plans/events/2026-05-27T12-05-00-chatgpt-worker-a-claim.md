# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T12:05:00+10:00

selected action: Extract CLI progress-log suppression policy from src/cli-core.ts into a focused output helper.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping; existing CLI behaviour remains compatible during migration.

intended branch: agent/chatgpt-worker-a/extract-progress-log-policy

PR number: none

files/directories likely to be touched:
- src/cli-core.ts
- src/cli/output/progress-log-policy.ts
- test/cli-progress-log-policy.test.ts
- plans/events/2026-05-27T12-05-00-chatgpt-worker-a-claim.md

collision check before claim:
- Open PR scan returned no open PRs.
- PR 256 is merged.
- Recent worker notes about PR 241/255/256 are stale or closed.
- This slice is narrow and avoids workspace/package files, continuation files, and worker-owned branches.
