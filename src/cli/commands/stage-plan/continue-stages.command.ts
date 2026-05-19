import { continueStagesFromPlan } from "../../../stage-runner.js";
import type { CommandHandler } from "../../command-context.js";
import {
  formatDryRunStageSummaryLines,
  formatNoPendingStagesSummaryLines,
  formatStageCompletedSummaryLines
} from "../../output/stage-plan-summary.js";

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
    for (const line of formatNoPendingStagesSummaryLines()) {
      writeLine(line);
    }
    return;
  }
  if (result.dryRun) {
    for (const line of formatDryRunStageSummaryLines(result.stageId, result.stagePlanPath)) {
      writeLine(line);
    }
    return;
  }
  for (const line of formatStageCompletedSummaryLines(result.stageId, result.status, result.stagePlanStatus, result.stageArtefactsDir)) {
    writeLine(line);
  }
};
