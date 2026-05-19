import { continueStagesFromPlan } from "../../../stage-runner.js";
import type { CommandHandler } from "../../command-context.js";

export const handleContinueStagesCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.stagePlanArg) {
    throw new Error("continue-stages requires --stage-plan <path>. Usage: agent-stage continue-stages --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]");
  }
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  const result = await continueStagesFromPlan({
    stagePlanArg: args.stagePlanArg,
    configArg: args.configArg,
    orchestratorRoot,
    allowWrites: args.allowWrites,
    dryRun: args.dryRun,
    verbose: args.verbose,
    streamCodex: args.streamCodex,
    progressLogger
  });
  if (result.noPendingStages) {
    writeLine("No pending stages.");
    writeLine("");
    writeLine("All stages are accepted or committed.");
    return;
  }
  if (result.dryRun) {
    writeLine(`Dry run: would run stage ${result.stageId}.`);
    writeLine(`Stage Plan: ${result.stagePlanPath}`);
    return;
  }
  writeLine("Stage completed and requires review.");
  writeLine("");
  writeLine(`Stage: ${result.stageId}`);
  writeLine(`Status: ${result.status}`);
  writeLine(`Stage Plan Status: ${result.stagePlanStatus}`);
  writeLine(`Artefacts: ${result.stageArtefactsDir}`);
  writeLine("");
  writeLine("Next:");
  writeLine(`  accept-stage ${result.stageId}`);
  writeLine(`  fix-stage ${result.stageId} --feedback "..."`);
};
