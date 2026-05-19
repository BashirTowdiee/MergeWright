import path from "node:path";
import { writePrSummary } from "../../change-report.js";
import { resolveRunDir } from "../../runs.js";
import type { CommandHandler } from "../command-context.js";
import {
  assertPathExists,
  formatChangeReportJson,
  formatChangeReportMarkdown,
  formatPrSummaryMarkdown,
  formatReportSummaryLines,
  generateChangeReport,
  loadConfigAndRunsRoot,
  pathExists,
  writeChangeReport
} from "../command-helpers.js";

export const handleReportRunCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error("Usage: agent-stage report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]");
  }
  const { configPath, config, runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  progressLogger.phaseStart("report", "loading config");
  progressLogger.verbose(`[report] config path: ${configPath}`);
  progressLogger.verbose(`[report] runs root: ${runsRoot}`);
  progressLogger.phaseStart("report", "resolving run directory");
  const runDir = resolveRunDir(runsRoot, args.runId);
  progressLogger.verbose(`[report] run directory: ${runDir}`);
  await assertPathExists(runDir, `Run does not exist: ${args.runId}`);

  progressLogger.phaseStart("report", "generating change report");
  const report = await generateChangeReport({ runDir, policy: config.changeReport });

  const markdownPath = path.resolve(runDir, "run-report.md");
  const jsonPath = path.resolve(runDir, "run-report.json");
  const prSummaryPath = path.resolve(runDir, "pr-summary.md");
  if (!args.stdoutOnly) {
    progressLogger.phaseStart("report", "writing report artefacts");
    if (!args.force) {
      const intendedOutputs = [markdownPath, jsonPath, ...(args.prSummary ? [prSummaryPath] : [])];
      for (const outputPath of intendedOutputs) {
        if (await pathExists(outputPath)) {
          if (outputPath === prSummaryPath) {
            throw new Error("PR summary artefact already exists. Use --force to overwrite.");
          }
          throw new Error("Report artefacts already exist. Use --force to overwrite.");
        }
      }
    }
    await writeChangeReport({ runDir, report });
    if (args.prSummary) {
      await writePrSummary({ runDir, report });
    }
  }
  progressLogger.phaseComplete("report", "completed");

  if (args.jsonOutput) {
    writeLine(formatChangeReportJson(report).trimEnd());
    return;
  }
  if (args.prSummary && args.stdoutOnly) {
    writeLine(formatPrSummaryMarkdown(report).trimEnd());
    return;
  }
  if (args.stdoutOnly) {
    writeLine(formatChangeReportMarkdown(report).trimEnd());
    return;
  }
  for (const line of formatReportSummaryLines(report, args.runId, markdownPath, jsonPath, args.prSummary ? prSummaryPath : null)) {
    writeLine(line);
  }
};
