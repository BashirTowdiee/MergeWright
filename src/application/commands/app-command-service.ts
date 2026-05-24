import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { CommandDescription } from "./command-description.js";

export type AppCommandExecutionOptions = {
  readonly confirmationContextId?: string;
  readonly confirmationToken?: string;
};

export interface AppCommandService {
  describe(command: AppCommand): Promise<CommandDescription>;
  execute(command: AppCommand, options?: AppCommandExecutionOptions): Promise<AppCommandResult>;
}