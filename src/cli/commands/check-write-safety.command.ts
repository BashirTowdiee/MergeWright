import type { CommandHandler } from "../command-context.js";
import { formatWriteSafetySummaryLines } from "../command-helpers.js";
import { runCheckWriteSafety } from "../run-check-write-safety.js";

export const handleCheckWriteSafetyCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, deps, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  const handler = deps.checkWriteSafetyHandler ?? runCheckWriteSafety;
  const outcome = await handler(args.configArg, orchestratorRoot, progressLogger);
  for (const line of formatWriteSafetySummaryLines(outcome)) {
    writeLine(line);
  }
  if (!outcome.result.ok) {
    throw new Error("check-write-safety failed");
  }
};
