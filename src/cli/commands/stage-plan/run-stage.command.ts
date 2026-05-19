import { runSingleStageFromPlan } from "../../../stage-runner.js";
import type { CommandHandler } from "../../command-context.js";
import { formatRunStageCompletedSummaryLines, formatRunStageDryRunSummaryLines } from "../../output/stage-plan-summary.js";

export const handleRunStageCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.stageId) {
    throw new Error("run-stage requires <stage-id>. Usage: agent-stage run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]");
  }
  if (!args.stagePlanArg) {
    throw new Error("run-stage requires --stage-plan <path>. Usage: agent-stage run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]");
  }
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  const result = await runSingleStageFromPlan({
    stageId: args.stageId,
    stagePlanArg: args.stagePlanArg,
    configArg: args.configArg,
    orchestratorRoot,
    allowWrites: args.allowWrites,
    dryRun: args.dryRun,
    verbose: args.verbose,
    streamCodex: args.streamCodex,
    progressLogger
  });
  if (result.dryRun) {
    for (const line of formatRunStageDryRunSummaryLines(result.stageId, result.stagePlanPath, result.stageArtefactsDir)) {
      writeLine(line);
    }
    return;
  }
  for (const line of formatRunStageCompletedSummaryLines(result.stageId, result.status, result.stageArtefactsDir, result.stagePlanPath)) {
    writeLine(line);
  }
};
