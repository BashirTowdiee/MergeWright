# OpenCode Backend

Shepherds-Staff recognises `opencode-cli` as an execution backend type in configuration and can instantiate an `OpenCodeCliBackend` skeleton from the backend registry.

OpenCode execution is not implemented yet. Calling `execute()` fails intentionally with a not-implemented error.

## Current support

Supported executable backend:

- `codex-cli`

Recognised and instantiable, but not executable yet:

- `opencode-cli`

Not supported:

- `claude-code-cli`
- `openrouter-api`
- `anthropic-api`
- `openai-api`

## Current capabilities

The OpenCode backend skeleton exposes conservative capabilities:

```json
{
  "providesHarness": true,
  "supportsLocalWorkspace": true,
  "supportsFileEdits": false,
  "supportsShellCommands": false,
  "supportsSandboxMode": false,
  "supportsStreaming": false,
  "supportsReasoningEffort": false,
  "supportsModelSelection": true
}
```

Planner, reviewer, builder, and fixer roles are still blocked by capability validation until sandbox and execution semantics are implemented.

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

The config validates and the registry can instantiate the backend, but execution fails clearly because command execution has not been added yet.

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

The next stage should define the read-only OpenCode command contract for planner/reviewer style phases without executing it. Do not enable builder or fixer roles until file-edit and shell-command behaviour is explicitly implemented and safety-gated.
