# Claim

worker-id: chatgpt-worker-b

timestamp: 2026-05-27T05:55:00+10:00

selected action: Extract CLI command dispatch from src/cli-core.ts into a focused CLI dispatch module.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping; existing CLI behaviour remains compatible during migration.

intended branch: agent/chatgpt-worker-b/extract-cli-dispatcher

PR number: none

files/directories likely to be touched:
- src/cli-core.ts
- src/cli/command-dispatcher.ts
- test/cli-command-dispatcher.test.ts
- plans/events/2026-05-27T05-55-00-chatgpt-worker-b-claim.md

collision check before claim:
- Open PR scan returned no open PRs.
- Recent PR 257 is merged.
- Recent PR 256 is merged.
- No fresh open PR owns this dispatcher extraction slice.
