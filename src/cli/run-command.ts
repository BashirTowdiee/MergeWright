import { dispatchCliCommand } from "./dispatch.js";
import { renderHelpText } from "./output/help-text.js";
import { createCliProgressLogger } from "./output/progress-log-policy.js";
import type { OpenRunDirectory, ParsedArgs, RunCommandDeps } from "./types.js";

export async function runCommand(
  args: ParsedArgs,
  orchestratorRoot: string,
  platform: NodeJS.Platform,
  openRunDirectory: OpenRunDirectory,
  writeLine: (line: string) => void = console.log,
  deps: RunCommandDeps = {}
): Promise<void> {
  const progressLogger = createCliProgressLogger(args, writeLine);

  if (args.help) {
    writeLine(renderHelpText(args.command));
    return;
  }

  await dispatchCliCommand({
    command: args.command,
    helpText: renderHelpText(),
    context: {
      args,
      orchestratorRoot,
      platform,
      openRunDirectory,
      writeLine,
      deps,
      progressLogger
    }
  });
}
