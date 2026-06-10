# MergeWright MCP Server

MergeWright ships a stdio MCP server for harnesses and editors that speak the Model Context Protocol. It exposes high-level MergeWright operations rather than asking the client to orchestrate internal steps itself.

## Build And Launch

Build the app workspace:

```bash
npm run build --workspace @mergewright/mcp
```

Launch the protocol-clean stdio server directly:

```bash
node dist/apps/mcp/src/main.js --orchestrator-root /absolute/path/to/mergewright
```

`npm run mergewright -- mcp` is useful for humans, but not for MCP clients. The npm wrapper and prelaunch build write to stdout before MCP negotiation begins.

## Client Configuration

Any MCP client that supports stdio launch can use the server with a `command` plus `args` config.

Generic stdio example:

```json
{
  "command": "node",
  "args": [
    "/absolute/path/to/mergewright/dist/apps/mcp/src/main.js",
    "--orchestrator-root",
    "/absolute/path/to/mergewright"
  ]
}
```

Example with an explicit working directory:

```json
{
  "command": "node",
  "args": [
    "dist/apps/mcp/src/main.js",
    "--orchestrator-root",
    "/absolute/path/to/mergewright"
  ],
  "cwd": "/absolute/path/to/mergewright"
}
```

## Tool Surface

Audited flow tools:

- `execute_audited_flow`
- `get_audited_flow_run`
- `get_audited_flow_events`
- `export_audited_flow_audit`

Project and state inspection:

- `list_projects`
- `get_settings`
- `get_project`
- `list_runs`
- `get_run_detail`
- `get_provider_inventory`
- `get_policy_snapshot`
- `get_write_safety_status`

CLI-equivalent command gateway:

- `preview_cli_command`
- `execute_cli_command`

## Project Resolution

Project-scoped tools resolve context in this order:

1. explicit `projectId`
2. active project from `.artifacts/web-settings.json`
3. first project in `.artifacts/projects.json`

For deterministic behavior in harnesses, prefer passing `projectId` explicitly.

## Audited Flow Examples

Deterministic dry-run flow:

```json
{
  "tool": "execute_audited_flow",
  "input": {
    "goal": "Add MCP support for project-scoped run inspection",
    "workspace": "/absolute/path/to/target/workspace",
    "dryRun": true
  }
}
```

Shell-check stage using project configuration:

```json
{
  "tool": "execute_audited_flow",
  "input": {
    "goal": "Run configured checks through MergeWright MCP",
    "workspace": "/absolute/path/to/target/workspace",
    "projectId": "default",
    "dryRun": false,
    "requiredChecks": ["orchestrator-build"],
    "stages": [
      {
        "id": "checks",
        "kind": "check",
        "executor": "shell-check"
      }
    ]
  }
}
```

`shell-check` is allowed only for `check` stages, and it requires either `projectId` or `configPath` so the server can load configured checks.

## Inspection Examples

List project runs:

```json
{
  "tool": "list_runs",
  "input": {
    "projectId": "default",
    "status": "all"
  }
}
```

Preview a typed CLI-equivalent command:

```json
{
  "tool": "preview_cli_command",
  "input": {
    "projectId": "default",
    "request": {
      "requestId": "preview-1",
      "command": {
        "command": "check-write-safety"
      }
    }
  }
}
```

Execute the same typed command through the shared gateway:

```json
{
  "tool": "execute_cli_command",
  "input": {
    "projectId": "default",
    "request": {
      "requestId": "exec-1",
      "command": {
        "command": "check-write-safety"
      }
    }
  }
}
```

## Recommended Harness Pattern

- Use `projectId` explicitly for any project-scoped operation.
- Use `preview_cli_command` before `execute_cli_command` when the harness needs confirmation or risk display.
- Use `execute_audited_flow` for MergeWright-owned stage progression instead of reproducing stage sequencing in the client.
