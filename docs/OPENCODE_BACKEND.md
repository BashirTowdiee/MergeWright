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

Real execution remains blocked by capability validation until sandbox and execution semantics are implemented.

## Dry-run routing

The backend adapter can route OpenCode dry-run requests for read-only roles. This is for command/artefact/routing validation only and does not spawn OpenCode.

Allowed dry-run roles:

- `planner`
- `reviewer`
- `fix-planner`
- `reassessor`

Rejected dry-run roles:

- `builder`
- `fixer`

Dry-run read-only validation requires only local workspace and model selection capabilities. Write roles keep the full write-role requirements even in dry-run.

## Dry-run result construction

`OpenCodeCliBackend.execute()` returns a deterministic `AgentExecutionResult` when `request.dryRun` is `true` and the role is read-only.

Dry-run results include command metadata, args, cwd, backend name/type, model, `success: true`, `skipped: true`, and no output text.

## CLI contract probe

Stage 6 adds a help/version-only contract probe for the installed OpenCode CLI.

The probe checks only:

```bash
opencode --version
opencode --help
opencode run --help
```

It does not execute agent prompts, pass prompt stdin, write output files, parse agent output, or enable real OpenCode execution.

The probe reports whether help output confirms:

- a `run` subcommand
- a model flag such as `--model`
- a workspace flag such as `--cwd`
- an output flag such as `--output`
- stdin prompt support

If support is unclear, the probe reports the capability as false and records an error. The command builder remains provisional until the contract is verified in the target environment.

## Manual CLI probe command

Stage 8 adds a manual CLI command:

```bash
npm run agent -- probe-opencode [--config <config-path>] [--backend <name>] [--command <command>] [--json] [--validate-readonly-contract]
```

Examples:

```bash
npm run agent -- probe-opencode --command opencode
npm run agent -- probe-opencode --config configs/example.json --backend opencode-reviewer --json
npm run agent -- probe-opencode --command opencode --validate-readonly-contract
```

Behavior:

- runs only `--version`, `--help`, and `run --help` probes
- never executes agent prompts
- never calls `OpenCodeCliBackend.execute()`
- never enables real OpenCode execution
- optional `--validate-readonly-contract` builds and validates a sample read-only command contract without executing it

## Provisional read-only command contract

The command contract is still provisional and no OpenCode process is spawned for agent execution.

Provisional command shape:

```bash
opencode run \
  --model <model> \
  --cwd <workspaceRoot> \
  --output <outputLastMessagePath> \
  -
```

The prompt is represented as stdin in the command contract. This shape is deliberately provisional and must be verified before any real execution stage is enabled.

## Stage 7 command validation

Stage 7 adds a contract-aware validation layer for the provisional read-only command builder.

`buildOpenCodeReadOnlyCommand()` remains provisional, and `validateOpenCodeReadOnlyCommandAgainstContract()` compares the built command with a verified `OpenCodeCliContract`.

Validation is fail-closed:

- command executable must match the verified contract command
- args must start with `run`
- `run` subcommand support must be confirmed
- `--model`, `--cwd`, `--output`, and stdin `-` must each be explicitly confirmed when present

This stage still does not execute OpenCode prompts or spawn a real OpenCode process.
Real execution remains disabled, and `OpenCodeCliBackend.execute()` still throws for non-dry-run.

Contract mismatch is intended to block future execution stages until the command contract is reconciled in the target environment.
Dry-run routing remains the only runner integration.

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

The next stage should decide how validated contracts are consumed by execution wiring while keeping execution safety constraints explicit. Do not spawn OpenCode for agent execution until an explicit real-execution stage is approved.
