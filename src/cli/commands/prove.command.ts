import { resolveRunDir } from "../../runs.js";
import { createProveResult } from "../../reporting/prove-report.js";
import type { CommandHandler } from "../command-context.js";
import { assertPathExists, generateChangeReport, loadConfigAndRunsRoot } from "../command-helpers.js";
import { formatProveSummaryLines } from "../output/prove-summary.js";

export const handleProveCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error("Usage: agent-stage prove <run-id> --config <config-path> [--json] [--verbose]");
  }

  const { configPath, config, runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  progressLogger.phaseStart("prove", "loading config");
  progressLogger.verbose(`[prove] config path: ${configPath}`);
  progressLogger.verbose(`[prove] runs root: ${runsRoot}`);

  progressLogger.phaseStart("prove", "resolving run directory");
  const runDir = resolveRunDir(runsRoot, args.runId);
  progressLogger.verbose(`[prove] run directory: ${runDir}`);
  await assertPathExists(runDir, `Run does not exist: ${args.runId}`);

  progressLogger.phaseStart("prove", "computing readiness proof");
  const report = await generateChangeReport({ runDir, policy: config.changeReport });
  const result = createProveResult(report);
  progressLogger.phaseComplete("prove", "completed");

  if (args.jsonOutput) {
    writeLine(JSON.stringify(result, null, 2));
  } else {
    for (const line of formatProveSummaryLines(result)) {
      writeLine(line);
    }
  }

  if (!result.ready) {
    throw new Error(`prove failed: ${result.report.status}`);
  }
};
