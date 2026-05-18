# Execution Backends

This document describes how Shepherds-Staff selects and records agent execution backends.

## What is an execution backend?

An execution backend is the runtime adapter that executes an agent request (planner, builder, reviewer) and returns process results plus optional backend metadata.

Current executable backend support is intentionally Codex-only.

- Executable backend type: `"codex-cli"`
- Recognised and instantiable, but execution is not implemented yet: `"opencode-cli"`
- Unsupported in current scope: Claude Code, OpenRouter, Anthropic API, OpenAI API

## Execution backend vs model provider

- Execution backend: how a command is executed (for example, the Codex CLI adapter).
- Model/provider selection: which model/reasoning profile is requested for an agent role.

In current executable scope, runtime execution remains Codex-oriented. Backend routing and model selection are configured separately so additional harness backends can be added explicitly later.

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

Codex backend config:

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

OpenCode config is recognised but not executable yet:

```json
{
  "executionBackends": {
    "opencode-reviewer": {
      "type": "opencode-cli",
      "command": "opencode"
    }
  },
  "agents": {
    "planner": {
      "backend": "opencode-reviewer",
      "model": "anthropic/claude-sonnet-4.5",
      "reasoningEffort": "high"
    },
    "builder": {
      "backend": "opencode-reviewer",
      "model": "anthropic/claude-sonnet-4.5",
      "reasoningEffort": "high"
    },
    "reviewer": {
      "backend": "opencode-reviewer",
      "model": "anthropic/claude-sonnet-4.5",
      "reasoningEffort": "high"
    }
  }
}
```

The registry can instantiate an `opencode-cli` backend skeleton. Calling its `execute()` method currently fails with a not-implemented error.

When legacy `codex` is used, config normalisation still builds Codex-only backend/agent mappings internally.

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
