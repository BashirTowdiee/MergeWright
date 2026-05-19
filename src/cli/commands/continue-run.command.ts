import path from "node:path";
import { continueRun } from "../../continue-run.js";
import { openFileInBrowser } from "../../open-file.js";
import type { CommandHandler } from "../command-context.js";
import { generateReportSummaryLines, loadAndValidateConfig, resolveConfigPath } from "../command-helpers.js";
import { formatContinueSummaryLines } from "../output/continue-run-summary.js";

export const handleContinueRunCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, deps, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error("Usage: agent-stage continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose] [--stream-codex] [--generate-report]");
  }
  const continueRunHandler = deps.continueRunHandler ?? continueRun;
  const result = await continueRunHandler({
    runId: args.runId,
    configArg: args.configArg,
    executeBuilder: args.executeBuilder,
    executeReviewer: args.executeReviewer,
    planFix: args.planFix,
    executeFix: args.executeFix,
    runChecks: args.runChecks,
    allowWrites: args.allowWrites,
    dryRun: args.dryRun,
    verbose: args.verbose,
    streamCodex: args.streamCodex,
    planHtml: args.planHtml || args.openPlan,
    orchestratorRoot,
    progressLogger
  });
  for (const line of formatContinueSummaryLines(result)) {
    writeLine(line);
  }
  if (args.planHtml || args.openPlan) {
    const planHtmlPath = path.resolve(result.runDir, "plan.html");
    writeLine(`Plan HTML: ${planHtmlPath}`);
    if (args.openPlan) {
      const openResult = await (deps.openPlanHandler ?? openFileInBrowser)(planHtmlPath);
      if (openResult.skipped) {
        writeLine(`warning: browser open skipped (${openResult.reason ?? "not supported"})`);
      } else if (!openResult.opened) {
        writeLine(`warning: failed to open browser (${openResult.reason ?? "unknown error"})`);
      }
    }
  }
  if (args.generateReport) {
    const reportSummaryLines = await generateReportSummaryLines({
      runDir: result.runDir,
      progressLogger,
      policy: (await loadAndValidateConfig(resolveConfigPath(orchestratorRoot, args.configArg))).changeReport
    });
    for (const line of reportSummaryLines) {
      writeLine(line);
    }
  }
};
