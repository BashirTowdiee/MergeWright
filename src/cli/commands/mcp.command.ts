import { startMergeWrightMcpServer } from "../../mcp/server.js";
import type { CommandHandler } from "../command-context.js";

export const handleMcpCommand: CommandHandler = async ({ orchestratorRoot, deps }) => {
  const handler =
    deps.mcpServerHandler ??
    (async (input: { orchestratorRoot: string }) =>
      startMergeWrightMcpServer({
        cwd: () => input.orchestratorRoot
      }));
  await handler({ orchestratorRoot });
};
