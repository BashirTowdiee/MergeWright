import { commandHandlers } from "./command-registry.js";
import { knownCommands } from "./known-commands.js";
import type { CommandHandlerContext } from "./command-context.js";

export interface CliDispatchRequest {
  command?: string;
  context: CommandHandlerContext;
  helpText: string;
}

export async function dispatchCliCommand(request: CliDispatchRequest): Promise<void> {
  if (!request.command) {
    throw new Error(["Missing command.", "", request.helpText].join("\n"));
  }

  if (!knownCommands.has(request.command)) {
    throw new Error(["Unknown command: " + request.command, "", request.helpText].join("\n"));
  }

  const handler = commandHandlers[request.command as keyof typeof commandHandlers];
  await handler(request.context);
}
