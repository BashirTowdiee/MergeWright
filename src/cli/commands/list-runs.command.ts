import { listRunDirectories, readRunSummary } from "../../runs.js";
import type { CommandHandler } from "../command-context.js";
import { loadConfigAndRunsRoot } from "../command-helpers.js";

export const handleListRunsCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  const { runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  const runIds = await listRunDirectories(runsRoot);
  writeLine(`Runs root: ${runsRoot}`);
  if (runIds.length === 0) {
    writeLine("No runs found.");
    return;
  }

  writeLine("run id | project | stage | preset | status | started | completed | planner | builder | reviewer | fix-plan | fix | checks");
  for (const runId of runIds) {
    const summary = await readRunSummary(runsRoot, runId);
    writeLine(
      `${summary.runId} | ${summary.projectName ?? "unknown"} | ${summary.stageName ?? "unknown"} | ${summary.preset ?? "none"} | ${summary.status} | ${summary.startedAt ?? summary.createdAt.toISOString()} | ${summary.completedAt ?? "-"} | ${summary.statuses.planner} | ${summary.statuses.builder} | ${summary.statuses.reviewer} | ${summary.statuses.fixPlanning} | ${summary.statuses.fixExecution} | ${summary.statuses.checks}`
    );
    for (const warning of summary.warnings) {
      writeLine(`warning: ${runId}: ${warning}`);
    }
  }
};
