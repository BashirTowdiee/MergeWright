import path from "node:path";

export interface ParsedMcpCliArgs {
  help: boolean;
  orchestratorRoot: string;
}

export function parseMcpCliArgs(argv: readonly string[], cwd: () => string = () => process.cwd()): ParsedMcpCliArgs {
  let help = false;
  let orchestratorRoot = path.resolve(cwd());

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--orchestrator-root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--orchestrator-root requires a value.");
      }
      orchestratorRoot = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--orchestrator-root=")) {
      const value = arg.slice("--orchestrator-root=".length).trim();
      if (!value) {
        throw new Error("--orchestrator-root requires a value.");
      }
      orchestratorRoot = path.resolve(value);
      continue;
    }

    throw new Error(`Unknown MCP argument: ${arg}`);
  }

  return {
    help,
    orchestratorRoot
  };
}

export function renderMcpHelpText(): string {
  return [
    "Usage: node dist/apps/mcp/src/main.js [--orchestrator-root <path>]",
    "",
    "Starts the MergeWright MCP server on stdio.",
    "",
    "Options:",
    "  --orchestrator-root <path>   Resolve projects, settings, configs, and runs from this MergeWright root.",
    "  --help, -h                   Show this help text.",
    "",
    "Notes:",
    "  - The MCP server writes JSON-RPC on stdout, so launch it directly instead of through npm wrappers.",
    "  - See docs/cli/mcp.md for client setup examples and available tools."
  ].join("\n");
}
