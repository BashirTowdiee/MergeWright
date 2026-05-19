import { acceptStageFromPlan } from "../../../stage-runner.js";
import type { CommandHandler } from "../../command-context.js";

export const handleAcceptStageCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  if (!args.stageId) {
    throw new Error("accept-stage requires <stage-id>. Usage: agent-stage accept-stage <stage-id> --stage-plan <path> [--auto-commit] [--commit-message <text>]");
  }
  if (!args.stagePlanArg) {
    throw new Error("accept-stage requires --stage-plan <path>. Usage: agent-stage accept-stage <stage-id> --stage-plan <path> [--auto-commit] [--commit-message <text>]");
  }
  const result = await acceptStageFromPlan({
    stageId: args.stageId,
    stagePlanArg: args.stagePlanArg,
    orchestratorRoot,
    autoCommit: args.autoCommit,
    commitMessage: args.commitMessage
  });
  writeLine(result.status === "committed" ? "Stage accepted and committed." : "Stage accepted.");
  writeLine("");
  writeLine(`Stage: ${result.stageId}`);
  writeLine(`Status: ${result.status}`);
  if (result.commitSha) {
    writeLine(`Commit SHA: ${result.commitSha}`);
  }
  writeLine(`Stage Plan: ${result.stagePlanPath}`);
};
