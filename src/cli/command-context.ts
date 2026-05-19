import type { ProgressLogger } from "../progress-logger.js";
import type { ParsedArgs, OpenRunDirectory, RunCommandDeps } from "./types.js";

export interface CommandContext {
  args: ParsedArgs;
  orchestratorRoot: string;
  platform: NodeJS.Platform;
  openRunDirectory: OpenRunDirectory;
  writeLine: (line: string) => void;
  deps: RunCommandDeps;
  progressLogger: ProgressLogger;
}

export type CommandHandler = (context: CommandContext) => Promise<void>;
