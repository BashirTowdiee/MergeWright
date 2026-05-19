import { fixStageFromPlan } from "../../../stage-runner.js";
import type { CommandHandler } from "../../command-context.js";
import { formatFixStageCompletedSummaryLines } from "../../output/stage-plan-summary.js";

export const handleFixStageCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.stageId) {
    throw new Error("fix-stage requires <stage-id>. Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--allow-writes] [--verbose] [--stream-codex]");
  }
  if (!args.stagePlanArg) {
    throw new Error("fix-stage requires --stage-plan <path>. Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--allow-writes] [--verbose] [--stream-codex]");
  }
  if (!args.feedback) {
    throw new Error("fix-stage requires --feedback <text>. Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--allow-writes] [--verbose] [--stream-codex]");
  }
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  const result = await fixStageFromPlan({
    stageId: args.stageId,
    stagePlanArg: args.stagePlanArg,
    configArg: args.configArg,
    feedback: args.feedback,
    orchestratorRoot,
    allowWrites: args.allowWrites,
    verbose: args.verbose,
    streamCodex: args.streamCodex,
    progressLogger,
    reassessDownstream: args.reassessDownstream
  });
  for (const line of formatFixStageCompletedSummaryLines(
    result.stageId,
    result.status,
    result.revision,
    result.feedbackPath,
    result.stagePlanPath,
    result.reassessment
  )) {
    writeLine(line);
  }
};
