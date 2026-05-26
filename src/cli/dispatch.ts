import { commandHandlers } from "./command-registry.js";
import type { CommandContext } from "./command-context.js";
import { knownCommands } from "./known-commands.js";

export interface CliDispatchRequest {
  command?: string;
  context: CommandContext;
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
