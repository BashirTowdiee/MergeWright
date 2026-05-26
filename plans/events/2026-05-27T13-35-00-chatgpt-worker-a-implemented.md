# Open-run directory adapter slice implemented

worker-id: chatgpt-worker-a

timestamp: 2026-05-27T13:35:00+10:00

selected action: Implement the next meaningful Stage 3.5 vertical slice by moving CLI open-run-directory process integration into the adapters package.

active stage: Stage 3.5 Monorepo and CLI boundary refactor.

acceptance criteria advanced:
- CLI app entrypoint no longer imports `node:child_process` directly.
- Process-bound open-run-directory behaviour now lives under `packages/adapters/src/open-run-directory.ts`.
- CLI presentation remains focused on argument parsing, command invocation, and process exit mapping.
- Existing CLI behaviour is preserved by passing the adapter function into `runCommand`.

files touched:
- apps/cli/src/main.ts
- packages/adapters/src/open-run-directory.ts
- packages/adapters/src/index.ts
- test/cli-app-boundary.test.ts
- test/open-run-directory-adapter.test.ts
- plans/events/2026-05-27T13-25-00-chatgpt-worker-a-claim.md
- plans/events/2026-05-27T13-35-00-chatgpt-worker-a-implemented.md

PR/branch:
- branch: agent/chatgpt-worker-a/extract-open-run-directory-adapter
- PR: pending creation

commit/head SHA: 9b520d22c943c13dcde105f2a429bc8619b9b990 before this event commit.

tests/checks run:
- Local tests not run from connector-only environment.
- Added focused boundary tests for the CLI app and open-run adapter separation.

CI status: not started before PR creation.

merge status: not merged.

blockers: none.

conflicting claims considered:
- Open PR scan returned no open PRs before implementation and before PR creation.
- PR 258 and PR 259 are merged.
- This slice avoids recently touched `src/cli-core.ts`, `src/cli/run-command.ts`, and `src/cli/dispatch.ts`.
- Older worker-b, worker-c, and worker-d notes are stale or refer to already-merged work.

stale claims ignored:
- Worker-b root CLI compatibility notes are superseded by later merged CLI runtime PRs.
- Worker-c/d package-lock blocker notes are stale because the referenced PR 241-era work is merged and no open PR remains.

next recommended action: open PR and wait for CI.

status: IMPLEMENTED
