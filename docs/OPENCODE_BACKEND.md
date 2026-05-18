# OpenCode Backend

Shepherds-Staff recognises `opencode-cli` as an execution backend type in configuration.

This is a config-only stage. OpenCode execution is not implemented yet.

## Current support

Supported executable backend:

- `codex-cli`

Recognised but not executable yet:

- `opencode-cli`

Not supported:

- `claude-code-cli`
- `openrouter-api`
- `anthropic-api`
- `openai-api`

## Example config

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

The config validates, but attempting to execute an `opencode-cli` backend fails clearly because the backend implementation has not been added yet.

## Command validation

The optional `command` field must be an executable name only.

Allowed:

```json
{ "type": "opencode-cli", "command": "opencode" }
```

Rejected:

```json
{ "type": "opencode-cli", "command": "" }
```

```json
{ "type": "opencode-cli", "command": "npx opencode" }
```

## Next implementation stage

The next stage should add an `OpenCodeCliBackend` skeleton with honest capabilities and tests. It should not enable builder or fixer roles until file-edit and shell-command behaviour is explicitly implemented and safety-gated.
