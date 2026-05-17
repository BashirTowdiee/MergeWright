# Execution Backends

This document describes how Shepherds-Staff selects and records agent execution backends.

## What is an execution backend?

An execution backend is the runtime adapter that executes an agent request (planner, builder, reviewer) and returns process results plus optional backend metadata.

Current backend support is intentionally Codex-only.

- Supported backend type: `"codex-cli"`
- Unsupported in current scope: OpenCode, Claude Code, OpenRouter, Anthropic API, OpenAI API

## Execution backend vs model provider

- Execution backend: how a command is executed (for example, the Codex CLI adapter).
- Model/provider selection: which model/reasoning profile is requested for an agent role.

In current scope, both are Codex-oriented, but they are configured separately so backend routing and model selection stay explicit.

## Config models

Legacy `codex` config remains supported:

```json
{
  "codex": {
    "planner": { "model": "gpt-5.3-codex", "reasoningEffort": "high" },
    "builder": { "model": "gpt-5.3-codex", "reasoningEffort": "high" },
    "reviewer": { "model": "gpt-5.3-codex", "reasoningEffort": "high" }
  }
}
```

New Codex-only backend config:

```json
{
  "executionBackends": {
    "codex-local": {
      "type": "codex-cli"
    }
  },
  "agents": {
    "planner": {
      "backend": "codex-local",
      "model": "gpt-5.3-codex",
      "reasoningEffort": "high"
    },
    "builder": {
      "backend": "codex-local",
      "model": "gpt-5.3-codex",
      "reasoningEffort": "high"
    },
    "reviewer": {
      "backend": "codex-local",
      "model": "gpt-5.3-codex",
      "reasoningEffort": "high"
    }
  }
}
```

When legacy `codex` is used, config normalization still builds Codex-only backend/agent mappings internally.

## Role selection

- Planner phase uses `agents.planner`
- Builder and fix execution phases use `agents.builder`
- Reviewer phase uses `agents.reviewer`
- Review-to-fix/fix planning uses planner-compatible execution routing

## Telemetry and artefacts

Backend metadata may appear in:

- Command artefacts (for executed phases), for example:
  - `03-planner-command.args.json`
  - `builder-command.json`
  - `reviewer-command.json`
  - `review-to-fix-command.json`
  - `fix-command.json`
- `run.json` phase metadata as optional `phases.<phase>.backend`

Metadata is only recorded when execution returns backend details. Explicit `codexExecutor` overrides that do not return backend metadata remain unchanged and do not invent backend fields.
