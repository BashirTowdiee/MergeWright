import { reassessStagePlan } from "../../../stage-reassessment.js";
import type { CommandHandler } from "../../command-context.js";

export const handleReassessStagePlanCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  if (!args.stagePlanArg) {
    throw new Error("reassess-stage-plan requires --stage-plan <path>. Usage: agent-stage reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]");
  }
  if (!args.fromStageId) {
    throw new Error("reassess-stage-plan requires --from <stage-id>. Usage: agent-stage reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]");
  }
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  const result = await reassessStagePlan({
    stagePlanArg: args.stagePlanArg,
    sourceStageId: args.fromStageId,
    configArg: args.configArg,
    orchestratorRoot,
    dryRun: args.dryRun
  });
  if (result.dryRun) {
    writeLine("Dry run succeeded.");
    writeLine(`Source stage: ${result.sourceStageId}`);
    writeLine(`Downstream stages: ${result.downstreamStageIds.length === 0 ? "(none)" : result.downstreamStageIds.join(", ")}`);
    writeLine(`Stage Plan: ${result.stagePlanPath}`);
    return;
  }
  if (result.downstreamStageIds.length === 0) {
    writeLine("No downstream stages to reassess.");
    writeLine(`Source stage: ${result.sourceStageId}`);
    writeLine(`Stage Plan: ${result.stagePlanPath}`);
    return;
  }
  writeLine("Downstream reassessment completed.");
  writeLine(`Source stage: ${result.sourceStageId}`);
  writeLine(`Downstream stages: ${result.downstreamStageIds.length}`);
  writeLine(`Changed statuses: ${result.changedStatuses.length}`);
  if (result.reassessmentDir) {
    writeLine(`Reassessment Artefacts: ${result.reassessmentDir}`);
  }
  writeLine(`Stage Plan: ${result.stagePlanPath}`);
};
