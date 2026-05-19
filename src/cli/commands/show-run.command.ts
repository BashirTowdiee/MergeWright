import { readRunDetails } from "../../runs.js";
import type { CommandHandler } from "../command-context.js";
import { loadConfigAndRunsRoot } from "../command-helpers.js";
import { formatRunDetailsLines } from "../output/run-details-summary.js";

export const handleShowRunCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error("Usage: agent-stage show-run <run-id> --config <config-path>");
  }
  const { runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  const details = await readRunDetails(runsRoot, args.runId);
  for (const line of formatRunDetailsLines(details)) {
    writeLine(line);
  }
};
