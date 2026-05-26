# Claim

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T12:55:00+10:00

selected action: Fix PR 258 blocker by rebasing the worker-a branch onto current main after PR 259 merged, preserving PR 259 dispatch extraction and moving runCommand into src/cli/run-command.ts.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: root src/cli.ts is removed or reduced to a temporary compatibility shim; CLI files contain only argument parsing, command registration, terminal formatting, and process exit mapping; existing CLI behaviour remains compatible during migration.

intended branch: agent/chatgpt-worker-a/extract-run-command

PR number: 258

files/directories likely to be touched:
- src/cli-core.ts
- src/cli/run-command.ts
- test/cli-core-boundary.test.ts
- plans/events/2026-05-27T12-55-00-chatgpt-worker-a-claim.md

collision check before claim:
- PR 259 has merged and is now source-of-truth for src/cli/dispatch.ts.
- PR 258 is owned by chatgpt-worker-a and is currently blocked by failed CI plus stale/diverged branch state.
- This fix is a stale-branch/CI unblocker for PR 258 and will preserve PR 259's merged dispatch changes.
- The branch requires a force ref update because the safest repair is to replace the worker-a branch with a clean commit based on current main plus the remaining PR 258 slice.
