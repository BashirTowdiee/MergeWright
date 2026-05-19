import { readRunDetails } from "../../runs.js";
import type { CommandHandler } from "../command-context.js";
import { loadConfigAndRunsRoot } from "../command-helpers.js";

export const handleOpenRunCommand: CommandHandler = async ({ args, orchestratorRoot, platform, openRunDirectory, writeLine }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error("Usage: agent-stage open-run <run-id> --config <config-path>");
  }
  const { runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  const details = await readRunDetails(runsRoot, args.runId);
  if (platform !== "darwin") {
    writeLine(`Auto-open unsupported on platform ${platform}. Run directory: ${details.runDir}`);
    return;
  }
  await openRunDirectory(details.runDir);
  writeLine(`Opened run directory: ${details.runDir}`);
};
