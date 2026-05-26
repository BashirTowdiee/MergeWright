# Claim

worker-id: chatgpt-worker-b

timestamp: 2026-05-27T06:05:00+10:00

selected action: Move CLI command runner into apps/cli runtime and reduce root src/cli.ts to a compatibility shim.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: root src/cli.ts is reduced to a temporary compatibility shim while CLI runtime/presentation lives under apps/cli.

intended branch: agent/chatgpt-worker-b/cli-runtime-shim

PR number: none

files/directories likely to be touched:
- apps/cli/src/main.ts
- apps/cli/src/runtime.ts
- src/cli.ts
- test/cli.test.ts
- plans/events/*

collision check:
- No open PRs at scan time.
- Recent package build/config claims are complete or superseded.
- No active conflicting claim found for CLI runtime shim scope.

Status: CLAIMED
