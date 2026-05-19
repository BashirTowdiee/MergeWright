import { initProject } from "../../init-project.js";
import type { CommandHandler } from "../command-context.js";
import { formatInitProjectSummaryLines } from "../output/init-project-summary.js";

export const handleInitProjectCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  if (!args.projectName || !args.workspaceArg) {
    throw new Error("Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
  }
  const result = await initProject({
    orchestratorRoot,
    projectName: args.projectName,
    workspaceArg: args.workspaceArg,
    force: args.force,
    verbose: args.verbose,
    writeLine
  });
  for (const line of formatInitProjectSummaryLines(result, orchestratorRoot)) {
    writeLine(line);
  }
};
