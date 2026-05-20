# Execution Backends

Execution backend config is defined via `executionBackends` and selected per role via `agents`.

- `codex-cli`: executable backend
- `opencode-cli`: recognised backend with probe and limited dry-run routing for read-only validation

Provider routing is configured per role:

- `agents.planner.backend`
- `agents.builder.backend`
- `agents.reviewer.backend`
