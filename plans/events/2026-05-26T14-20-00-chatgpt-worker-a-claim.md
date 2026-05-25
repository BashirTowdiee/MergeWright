# Claim event

Timestamp: 2026-05-26T14:20:00 Australia/Melbourne

worker-id: chatgpt-worker-a

selected action: Implement the Stage 3.5 workspace skeleton slice without changing runtime behaviour.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criterion: root package uses workspaces or an equivalent explicit multi-package layout; package migration can continue with explicit app/package boundaries while preserving current CLI behaviour.

intended branch: agent/chatgpt-worker-a/workspace-skeleton

PR number: none yet

files/directories likely to be touched:
- package.json
- apps/api/package.json
- apps/cli/package.json
- apps/web/package.json
- packages/application/package.json
- packages/domain/package.json
- packages/adapters/package.json
- packages/config/package.json
- packages/shared/package.json
- test/package-config.test.ts
- plans/workers/chatgpt-worker-a.md
- plans/events/*
- plans/coordination.md

collision assessment:
- No open PRs found at claim time.
- No agent/* branches found at claim time.
- Recent Stage 3.5 PRs #236, #237, and #238 are merged.
- This slice avoids moving existing source files and avoids overlapping with prior CLI entrypoint/process-boundary changes.
