import path from "node:path";
import { runStage } from "../../runner.js";
import { continueRun } from "../../continue-run.js";
import { executeAutoChainSinglePass, formatAutoChainDryRunSummaryLines, formatAutoChainExecutionSummaryLines, projectAutoChainDryRun } from "../../auto-chain.js";
import { openFileInBrowser } from "../../open-file.js";
import type { CommandHandler } from "../command-context.js";
import { generateReportSummaryLines, loadAndValidateConfig, resolveConfigPath } from "../command-helpers.js";
import { formatSummaryLines } from "../output/run-summary.js";

export const handleRunCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, deps, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.stageName) {
    throw new Error("Usage: agent-stage run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--generate-report]");
  }

  if (args.autoChain) {
    if (args.dryRun) {
      const summary = await projectAutoChainDryRun({
        stageName: args.stageName,
        configArg: args.configArg,
        repoOverride: args.repoOverride,
        orchestratorRoot,
        allowWrites: args.allowWrites,
        streamCodex: args.streamCodex,
        maxFixAttempts: args.maxFixAttempts ?? 1,
        progressLogger
      });
      for (const line of formatAutoChainDryRunSummaryLines(summary)) {
        writeLine(line);
      }
      if (args.generateReport) {
        writeLine("AI Change Report skipped: auto-chain dry-run projection does not create a run directory.");
      }
      return;
    }
    const autoChainHandler =
      deps.autoChainHandler ??
      ((params) =>
        executeAutoChainSinglePass({
          ...params,
          runStageHandler: runStage,
          continueRunHandler: continueRun
        }));
    const summary = await autoChainHandler({
      stageName: args.stageName,
      configArg: args.configArg,
      repoOverride: args.repoOverride,
      orchestratorRoot,
      allowWrites: args.allowWrites,
      streamCodex: args.streamCodex,
      maxFixAttempts: args.maxFixAttempts ?? 1,
      verbose: args.verbose,
      progressLogger
    });
    for (const line of formatAutoChainExecutionSummaryLines(summary)) {
      writeLine(line);
    }
    if (args.generateReport) {
      const reportSummaryLines = await generateReportSummaryLines({
        runDir: summary.runDir,
        progressLogger,
        policy: (await loadAndValidateConfig(resolveConfigPath(orchestratorRoot, args.configArg))).changeReport
      });
      for (const line of reportSummaryLines) {
        writeLine(line);
      }
    }
    return;
  }

  const runHandler = deps.runHandler ?? runStage;
  const result = await runHandler({
    stageName: args.stageName,
    configArg: args.configArg,
    repoOverride: args.repoOverride,
    dryRun: args.dryRun,
    executePlanner: args.executePlanner,
    executeBuilder: args.executeBuilder,
    executeReviewer: args.executeReviewer,
    planFix: args.planFix,
    executeFix: args.executeFix,
    runChecks: args.runChecks,
    allowWrites: args.allowWrites,
    preset: args.preset,
    verbose: args.verbose,
    streamCodex: args.streamCodex,
    planHtml: args.planHtml || args.openPlan,
    orchestratorRoot,
    progressLogger
  });

  for (const line of formatSummaryLines(
    result,
    args.preset,
    args.executePlanner,
    args.executeBuilder,
    args.executeReviewer,
    args.planFix,
    args.executeFix,
    args.runChecks,
    args.allowWrites,
    result.writeSafetyState,
    result.writeEnabledPhases
  )) {
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
