import { runSingleStageFromPlan } from "../../../stage-runner.js";
import type { CommandHandler } from "../../command-context.js";

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
    writeLine("Dry run succeeded.");
    writeLine(`Stage: ${result.stageId}`);
    writeLine(`Would run using stage plan: ${result.stagePlanPath}`);
    writeLine(`Would write artefacts: ${result.stageArtefactsDir}`);
    return;
  }
  writeLine("Stage completed and requires review.");
  writeLine("");
  writeLine(`Stage: ${result.stageId}`);
  writeLine(`Status: ${result.status}`);
  writeLine(`Artefacts: ${result.stageArtefactsDir}`);
  writeLine(`Stage Plan: ${result.stagePlanPath}`);
};
