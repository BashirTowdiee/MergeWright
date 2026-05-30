import { resolveRunDir } from "../../runs.js";
import { createFocusedReviewModesResult, parseFocusedReviewModesArg } from "../../reporting/review-modes.js";
import type { CommandHandler } from "../command-context.js";
import { assertPathExists, generateChangeReport, loadConfigAndRunsRoot } from "../command-helpers.js";
import { formatReviewModesSummaryLines } from "../output/review-modes-summary.js";

export const handleReviewModesCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error(
      "Usage: agent-stage review-modes <run-id> --config <config-path> [--modes architecture,tests,regression,security,docs,maintainability] [--json] [--verbose]"
    );
  }

  const modes = parseFocusedReviewModesArg(args.modesArg);
  const { configPath, config, runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  progressLogger.phaseStart("review-modes", "loading config");
  progressLogger.verbose(`[review-modes] config path: ${configPath}`);
  progressLogger.verbose(`[review-modes] runs root: ${runsRoot}`);

  progressLogger.phaseStart("review-modes", "resolving run directory");
  const runDir = resolveRunDir(runsRoot, args.runId);
  progressLogger.verbose(`[review-modes] run directory: ${runDir}`);
  await assertPathExists(runDir, `Run does not exist: ${args.runId}`);

  progressLogger.phaseStart("review-modes", "building focused review results");
  const report = await generateChangeReport({ runDir, policy: config.changeReport });
  const result = createFocusedReviewModesResult({ report, modes });
  progressLogger.phaseComplete("review-modes", "completed");

  if (args.jsonOutput) {
    writeLine(JSON.stringify(result, null, 2));
  } else {
    for (const line of formatReviewModesSummaryLines(result)) {
      writeLine(line);
    }
  }

  if (result.aggregateVerdict !== "PASS") {
    throw new Error(`review-modes failed: ${result.aggregateVerdict}`);
  }
};
