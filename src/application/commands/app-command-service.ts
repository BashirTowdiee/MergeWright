import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { CommandDescription } from "./command-description.js";

export interface AppCommandService {
  describe(command: AppCommand): Promise<CommandDescription>;
  execute(command: AppCommand): Promise<AppCommandResult>;
}
