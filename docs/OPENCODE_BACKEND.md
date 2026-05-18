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

## Provisional read-only command contract

Stage 3 defines a tested command builder only. It does not execute OpenCode.

Allowed command-construction roles:

- `planner`
- `reviewer`
- `fix-planner`
- `reassessor`

Rejected command-construction roles:

- `builder`
- `fixer`

Provisional command shape:

```bash
opencode run \
  --model <model> \
  --cwd <workspaceRoot> \
  --output <outputLastMessagePath> \
  -
```

The prompt is represented as stdin in the command contract. This shape is deliberately provisional and must be verified before any execution stage is enabled.

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

The next stage should add dry-run-only OpenCode execution results. Do not spawn OpenCode or enable real execution until the command contract is verified.
