worker-id: chatgpt-worker-b
selected action: 5
active stage: Stage 3.5 Monorepo and CLI boundary refactor
acceptance criterion: CLI workspace package exposes the same mergewright binary boundary as the root package while preserving current build behaviour
intended branch: agent/chatgpt-worker-b/cli-package-bin-boundary
PR: none yet
likely files: apps/cli/package.json, test/cli-package-boundary.test.ts, plans/workers/chatgpt-worker-b.md
timestamp: 2026-05-27T18:45:00+10:00
evidence used: operating contract small-slice and planning rules; roadmap Stage 3.5 CLI binary acceptance criterion; root package already points mergewright at dist/apps/cli/src/main.js; apps/cli package has main but no bin; live open PR scan returned no open PRs
collision decision: no open PR or fresh active claim owns apps/cli/package.json or test/cli-package-boundary.test.ts
