# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T11:12:00+10:00

selected action: Extract CLI help text renderer from src/cli-core.ts into a dedicated output module.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping; root compatibility shim remains reduced; existing CLI behaviour remains compatible during migration.

intended branch: agent/chatgpt-worker-a/extract-cli-core-help-text

PR number: none

files/directories likely to be touched:
- src/cli-core.ts
- src/cli/output/help-text.ts
- test/cli-help-text.test.ts
- plans/events/2026-05-27T11-12-00-chatgpt-worker-a-claim.md

collision check before claim:
- Open PR scan returned no open PRs.
- PR 255 is merged.
- Existing worker-a branch agent/chatgpt-worker-a/extract-cli-help-text already exists, so this cycle uses a new worker-a-owned branch without force-updating it.
- This slice is narrow and CLI presentation-only.
