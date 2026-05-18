# OpenCode Backend

Shepherds-Staff recognises `opencode-cli` as an execution backend type in configuration and can instantiate an `OpenCodeCliBackend` skeleton from the backend registry.

Real OpenCode execution is not implemented yet. Calling `execute()` with `dryRun: false` fails intentionally with a not-implemented error.

## Current support

Supported executable backend:

- `codex-cli`

Recognised and instantiable, with dry-run result construction only:

- `opencode-cli`

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

## Dry-run result construction

`OpenCodeCliBackend.execute()` can return a deterministic `AgentExecutionResult` when `request.dryRun` is `true` and the role is read-only.

Allowed dry-run roles:

- `planner`
- `reviewer`
- `fix-planner`
- `reassessor`

Rejected dry-run roles:

- `builder`
- `fixer`

Dry-run results include command metadata, args, cwd, backend name/type, model, `success: true`, `skipped: true`, and no output text.

## Provisional read-only command contract

The command contract is still provisional and no OpenCode process is spawned.

Provisional command shape:

```bash
opencode run \
  --model <model> \
  --cwd <workspaceRoot> \
  --output <outputLastMessagePath> \
  -
```

The prompt is represented as stdin in the command contract. This shape is deliberately provisional and must be verified before any real execution stage is enabled.

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

The config validates and the registry can instantiate the backend, but real execution fails clearly because command execution has not been added yet.

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

The next stage should add capability-gated dry-run routing integration. Do not spawn OpenCode or enable real execution until the command contract is verified.
