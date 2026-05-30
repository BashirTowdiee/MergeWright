import { resolveRunDir } from "../../runs.js";
import { createCompareRunsReport } from "../../reporting/compare-runs.js";
import type { CommandHandler } from "../command-context.js";
import { assertPathExists, generateChangeReport, loadConfigAndRunsRoot } from "../command-helpers.js";
import { formatCompareRunsSummaryLines } from "../output/compare-runs-summary.js";

export const handleCompareRunsCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId || !args.compareRunId) {
    throw new Error("Usage: agent-stage compare-runs <run-id-a> <run-id-b> --config <config-path> [--json] [--verbose]");
  }

  const { configPath, config, runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  progressLogger.phaseStart("compare-runs", "loading config");
  progressLogger.verbose(`[compare-runs] config path: ${configPath}`);
  progressLogger.verbose(`[compare-runs] runs root: ${runsRoot}`);

  progressLogger.phaseStart("compare-runs", "resolving run directories");
  const runDirA = resolveRunDir(runsRoot, args.runId);
  const runDirB = resolveRunDir(runsRoot, args.compareRunId);
  progressLogger.verbose(`[compare-runs] run A directory: ${runDirA}`);
  progressLogger.verbose(`[compare-runs] run B directory: ${runDirB}`);
  await assertPathExists(runDirA, `Run does not exist: ${args.runId}`);
  await assertPathExists(runDirB, `Run does not exist: ${args.compareRunId}`);

  progressLogger.phaseStart("compare-runs", "building reports");
  const [reportA, reportB] = await Promise.all([
    generateChangeReport({ runDir: runDirA, policy: config.changeReport }),
    generateChangeReport({ runDir: runDirB, policy: config.changeReport })
  ]);
  const comparison = createCompareRunsReport(reportA, reportB);
  progressLogger.phaseComplete("compare-runs", "completed");

  if (args.jsonOutput) {
    writeLine(JSON.stringify(comparison, null, 2));
    return;
  }
  for (const line of formatCompareRunsSummaryLines(comparison)) {
    writeLine(line);
  }
};
