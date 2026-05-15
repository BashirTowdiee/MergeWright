#!/usr/bin/env node
import process from "node:process";
import { spawn } from "node:child_process";
import path from "node:path";
import { access } from "node:fs/promises";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import {
  formatChangeReportJson,
  formatChangeReportMarkdown,
  formatPrSummaryMarkdown,
  generateChangeReport,
  writeChangeReport,
  writePrSummary
} from "./change-report.js";
import { continueRun } from "./continue-run.js";
import { createGitInspectionClient, type GitInspectionClient } from "./git-inspection.js";
import { initProject } from "./init-project.js";
import { resolvePipelinePreset, type PipelinePreset } from "./presets.js";
import { createProgressLogger, NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { runStage } from "./runner.js";
import {
  type AutoChainExecutionSummary,
  executeAutoChainSinglePass,
  formatAutoChainDryRunSummaryLines,
  formatAutoChainExecutionSummaryLines,
  projectAutoChainDryRun
} from "./auto-chain.js";
import { listRunDirectories, readRunDetails, readRunSummary, resolveRunDir, resolveRunsRoot } from "./runs.js";
import { checkWriteSafety, type WriteSafetyResult } from "./write-safety.js";

interface ParsedArgs {
  command?: string;
  help: boolean;
  stageName?: string;
  runId?: string;
  projectName?: string;
  configArg?: string;
  workspaceArg?: string;
  repoOverride?: string;
  preset?: PipelinePreset;
  force: boolean;
  jsonOutput?: boolean;
  stdoutOnly?: boolean;
  prSummary?: boolean;
  dryRun: boolean;
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  runChecks: boolean;
  allowWrites: boolean;
  verbose: boolean;
  streamCodex: boolean;
  autoChain: boolean;
  maxFixAttempts?: number;
  generateReport: boolean;
}

interface SummaryResult {
  stageName: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  configPath: string;
  runDir: string;
  artefacts: string[];
  dryRun: boolean;
  checksState: "disabled" | "skipped by dry-run" | "executed" | "failed";
}

export type OpenRunDirectory = (runDir: string) => Promise<void>;
export type CheckWriteSafetyHandler = (
  configPath: string,
  orchestratorRoot: string,
  progressLogger: ProgressLogger
) => Promise<CheckWriteSafetyRunResult>;

interface RunCommandDeps {
  checkWriteSafetyHandler?: CheckWriteSafetyHandler;
  runHandler?: typeof runStage;
  continueRunHandler?: typeof continueRun;
  autoChainHandler?: (args: {
    stageName: string;
    configArg: string;
    repoOverride?: string;
    orchestratorRoot: string;
    allowWrites: boolean;
    streamCodex: boolean;
    maxFixAttempts: number;
    verbose: boolean;
    progressLogger: ProgressLogger;
  }) => Promise<AutoChainExecutionSummary>;
}

interface CheckWriteSafetyRunResult {
  configPath: string;
  workspaceRoot: string;
  result: WriteSafetyResult;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runCommand(args, process.cwd(), process.platform, defaultOpenRunDirectory);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${msg}`);
    process.exitCode = 1;
  }
}

export async function runCommand(
  args: ParsedArgs,
  orchestratorRoot: string,
  platform: NodeJS.Platform,
  openRunDirectory: OpenRunDirectory,
  writeLine: (line: string) => void = console.log,
  deps: RunCommandDeps = {}
): Promise<void> {
  const jsonOnlyStdout =
    args.command === "report-run" && (args.jsonOutput === true || (args.prSummary === true && args.stdoutOnly === true));
  const progressLogger = jsonOnlyStdout ? NOOP_PROGRESS_LOGGER : createProgressLogger(writeLine, { verbose: args.verbose });

  if (args.help) {
    writeLine(renderHelpText(args.command));
    return;
  }

  if (!args.command) {
    throw new Error(`Missing command.\n\n${renderHelpText()}`);
  }

  const knownCommands = new Set(["run", "continue-run", "list-runs", "show-run", "open-run", "report-run", "init-project", "check-write-safety"]);
  if (!knownCommands.has(args.command)) {
    throw new Error(`Unknown command: ${args.command}\n\n${renderHelpText()}`);
  }

  if (args.command === "init-project") {
    if (!args.projectName || !args.workspaceArg) {
      throw new Error("Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
    }
    const result = await initProject({
      orchestratorRoot,
      projectName: args.projectName,
      workspaceArg: args.workspaceArg,
      force: args.force,
      verbose: args.verbose,
      writeLine
    });
    for (const line of formatInitProjectSummaryLines(result, orchestratorRoot)) {
      writeLine(line);
    }
    return;
  }

  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }

  if (args.command === "check-write-safety") {
    const handler = deps.checkWriteSafetyHandler ?? runCheckWriteSafety;
    const outcome = await handler(args.configArg, orchestratorRoot, progressLogger);
    for (const line of formatWriteSafetySummaryLines(outcome)) {
      writeLine(line);
    }
    if (!outcome.result.ok) {
      throw new Error("check-write-safety failed");
    }
    return;
  }

  if (args.command === "run") {
    if (!args.stageName) {
      throw new Error(
        "Usage: agent-stage run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--generate-report]"
      );
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
        ((params: {
          stageName: string;
          configArg: string;
          repoOverride?: string;
          orchestratorRoot: string;
          allowWrites: boolean;
          streamCodex: boolean;
          maxFixAttempts: number;
          verbose: boolean;
          progressLogger: ProgressLogger;
        }) =>
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
        const reportSummaryLines = await generateReportSummaryLines({ runDir: summary.runDir, progressLogger });
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
    if (args.generateReport) {
      const reportSummaryLines = await generateReportSummaryLines({ runDir: result.runDir, progressLogger });
      for (const line of reportSummaryLines) {
        writeLine(line);
      }
    }
    return;
  }

  if (args.command === "continue-run") {
    if (!args.runId) {
      throw new Error(
        "Usage: agent-stage continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose] [--stream-codex] [--generate-report]"
      );
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
      orchestratorRoot,
      progressLogger
    });
    for (const line of formatContinueSummaryLines(result)) {
      writeLine(line);
    }
    if (args.generateReport) {
      const reportSummaryLines = await generateReportSummaryLines({ runDir: result.runDir, progressLogger });
      for (const line of reportSummaryLines) {
        writeLine(line);
      }
    }
    return;
  }

  const configPath = resolveConfigPath(orchestratorRoot, args.configArg);
  const config = await loadAndValidateConfig(configPath);
  const runsRoot = resolveRunsRoot(orchestratorRoot, config);

  if (args.command === "list-runs") {
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
    return;
  }

  if (args.command === "show-run") {
    if (!args.runId) {
      throw new Error("Usage: agent-stage show-run <run-id> --config <config-path>");
    }
    const details = await readRunDetails(runsRoot, args.runId);
    for (const line of formatRunDetailsLines(details)) {
      writeLine(line);
    }
    return;
  }

  if (args.command === "open-run") {
    if (!args.runId) {
      throw new Error("Usage: agent-stage open-run <run-id> --config <config-path>");
    }
    const details = await readRunDetails(runsRoot, args.runId);
    if (platform !== "darwin") {
      writeLine(`Auto-open unsupported on platform ${platform}. Run directory: ${details.runDir}`);
      return;
    }
    await openRunDirectory(details.runDir);
    writeLine(`Opened run directory: ${details.runDir}`);
    return;
  }

  if (args.command === "report-run") {
    if (!args.runId) {
      throw new Error(
        "Usage: agent-stage report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]"
      );
    }
    progressLogger.phaseStart("report", "loading config");
    progressLogger.verbose(`[report] config path: ${configPath}`);
    progressLogger.verbose(`[report] runs root: ${runsRoot}`);
    progressLogger.phaseStart("report", "resolving run directory");
    const runDir = resolveRunDir(runsRoot, args.runId);
    progressLogger.verbose(`[report] run directory: ${runDir}`);
    await assertPathExists(runDir, `Run does not exist: ${args.runId}`);

    progressLogger.phaseStart("report", "generating change report");
    const report = await generateChangeReport({ runDir });

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
    return;
  }

  throw new Error(renderHelpText());
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, firstArg, ...tail] = argv;
  const parsed: ParsedArgs = {
    command,
    help: false,
    force: false,
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    executeReviewer: false,
    planFix: false,
    executeFix: false,
    runChecks: false,
    allowWrites: false,
    verbose: false,
    streamCodex: false,
    autoChain: false,
    generateReport: false
  };

  if (command === "--help" || command === "-h") {
    parsed.command = undefined;
    parsed.help = true;
    return parsed;
  }

  if (!command) {
    if (argv.length === 0) {
      throw new Error(`Missing command.\n\n${renderHelpText()}`);
    }
    if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
      parsed.help = true;
      return parsed;
    }
  }

  if (command && (firstArg === "--help" || firstArg === "-h")) {
    parsed.help = true;
    return parsed;
  }

  if (command === "run") {
    parsed.stageName = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "init-project") {
    parsed.projectName = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "show-run" || command === "open-run" || command === "continue-run" || command === "report-run") {
    parsed.runId = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  }
  const rest =
    command === "run"
      ? firstArg && firstArg.startsWith("-")
        ? [firstArg, ...tail]
        : tail
      : command === "show-run" || command === "open-run" || command === "continue-run" || command === "report-run"
        ? firstArg && firstArg.startsWith("-")
          ? [firstArg, ...tail]
          : tail
        : command === "init-project"
          ? firstArg && firstArg.startsWith("-")
            ? [firstArg, ...tail]
            : tail
        : [firstArg, ...tail].filter((token): token is string => typeof token === "string");

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }
    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (token === "--execute-planner") {
      parsed.executePlanner = true;
      continue;
    }
    if (token === "--execute-builder") {
      parsed.executeBuilder = true;
      continue;
    }
    if (token === "--execute-reviewer") {
      parsed.executeReviewer = true;
      continue;
    }
    if (token === "--plan-fix") {
      parsed.planFix = true;
      continue;
    }
    if (token === "--execute-fix") {
      parsed.executeFix = true;
      continue;
    }
    if (token === "--verbose") {
      parsed.verbose = true;
      continue;
    }
    if (token === "--stream-codex") {
      parsed.streamCodex = true;
      continue;
    }
    if (token === "--auto-chain") {
      parsed.autoChain = true;
      continue;
    }
    if (token === "--generate-report") {
      parsed.generateReport = true;
      continue;
    }
    if (token === "--max-fix-attempts") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --max-fix-attempts");
      }
      if (!/^-?\d+$/.test(value.trim())) {
        throw new Error("--max-fix-attempts must be an integer from 0 to 5.");
      }
      const parsedValue = Number.parseInt(value, 10);
      if (parsedValue < 0 || parsedValue > 5) {
        throw new Error("--max-fix-attempts must be an integer from 0 to 5.");
      }
      parsed.maxFixAttempts = parsedValue;
      i += 1;
      continue;
    }
    if (token === "--force") {
      if (parsed.command !== "init-project" && parsed.command !== "report-run") {
        throw new Error("--force is only supported for init-project and report-run");
      }
      parsed.force = true;
      continue;
    }
    if (token === "--json") {
      parsed.jsonOutput = true;
      continue;
    }
    if (token === "--stdout-only") {
      parsed.stdoutOnly = true;
      continue;
    }
    if (token === "--pr-summary") {
      parsed.prSummary = true;
      continue;
    }
    if (token === "--run-checks") {
      parsed.runChecks = true;
      continue;
    }
    if (token === "--allow-writes") {
      parsed.allowWrites = true;
      continue;
    }
    if (token === "--preset") {
      if (parsed.command === "continue-run") {
        throw new Error("--preset is not supported for continue-run.");
      }
      if (parsed.preset) {
        throw new Error("Repeated --preset is not allowed. Provide at most one preset.");
      }
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --preset");
      }
      parsed.preset = value as PipelinePreset;
      i += 1;
      continue;
    }
    if (token === "--config") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --config");
      }
      parsed.configArg = value;
      i += 1;
      continue;
    }
    if (token === "--repo") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --repo");
      }
      parsed.repoOverride = value;
      i += 1;
      continue;
    }
    if (token === "--workspace") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --workspace");
      }
      parsed.workspaceArg = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (parsed.allowWrites && parsed.command !== "run" && parsed.command !== "continue-run") {
    throw new Error("--allow-writes is only supported for run and continue-run");
  }
  if (parsed.streamCodex && parsed.command !== "run" && parsed.command !== "continue-run") {
    throw new Error("--stream-codex is only supported for run and continue-run");
  }
  if (parsed.autoChain && parsed.command !== "run") {
    throw new Error("--auto-chain is only supported for run.");
  }
  if (parsed.generateReport && parsed.command !== "run" && parsed.command !== "continue-run") {
    throw new Error("--generate-report is only supported for run and continue-run.");
  }
  if (parsed.maxFixAttempts != null && !parsed.autoChain) {
    throw new Error("--max-fix-attempts is only supported with --auto-chain.");
  }
  if ((parsed.jsonOutput || parsed.stdoutOnly || parsed.prSummary) && parsed.command !== "report-run") {
    throw new Error("--json, --pr-summary, and --stdout-only are only supported for report-run");
  }
  if (parsed.command === "report-run" && parsed.jsonOutput && parsed.prSummary && parsed.stdoutOnly) {
    throw new Error(
      "--json cannot be combined with --pr-summary and --stdout-only because stdout can contain only one machine-readable format."
    );
  }

  if (parsed.command === "run") {
    if (parsed.help) {
      return parsed;
    }
    if (parsed.autoChain) {
      if (parsed.preset) {
        throw new Error("--auto-chain cannot be combined with --preset.");
      }
      if (
        parsed.executePlanner ||
        parsed.executeBuilder ||
        parsed.executeReviewer ||
        parsed.planFix ||
        parsed.executeFix ||
        parsed.runChecks
      ) {
        throw new Error(
          "--auto-chain cannot be combined with explicit phase flags: --execute-planner, --execute-builder, --execute-reviewer, --plan-fix, --execute-fix, --run-checks."
        );
      }
      parsed.maxFixAttempts = parsed.maxFixAttempts ?? 1;
      return parsed;
    }
    const presetOptions = resolvePipelinePreset(parsed.preset);
    parsed.executePlanner = parsed.executePlanner || presetOptions.executePlanner;
    parsed.executeBuilder = parsed.executeBuilder || presetOptions.executeBuilder;
    parsed.executeReviewer = parsed.executeReviewer || presetOptions.executeReviewer;
    parsed.planFix = parsed.planFix || presetOptions.planFix;
    parsed.executeFix = parsed.executeFix || presetOptions.executeFix;
    parsed.runChecks = parsed.runChecks || presetOptions.runChecks;

    if (parsed.executeBuilder && !parsed.executePlanner) {
      throw new Error("--execute-builder requires --execute-planner because builder prompt extraction depends on planner output.");
    }
    if (parsed.executeReviewer && !parsed.executePlanner) {
      throw new Error("--execute-reviewer requires --execute-planner because reviewer context depends on planner artefacts.");
    }
    if (parsed.planFix && !parsed.executeReviewer) {
      throw new Error("--plan-fix requires --execute-reviewer because fix planning depends on reviewer output.");
    }
    if (parsed.executeFix && !parsed.planFix) {
      throw new Error("--execute-fix requires --plan-fix because fix execution depends on review-to-fix output.");
    }
    if (parsed.allowWrites && !parsed.executeBuilder && !parsed.executeFix) {
      throw new Error("--allow-writes requires at least one write-eligible phase: --execute-builder or --execute-fix.");
    }
    if (parsed.allowWrites && (parsed.executeBuilder || parsed.executeFix) && !parsed.executeReviewer && !parsed.dryRun) {
      throw new Error("--allow-writes requires --execute-reviewer for post-write review");
    }
  }
  if (parsed.command === "continue-run") {
    if (parsed.help) {
      return parsed;
    }
    if (parsed.executePlanner) {
      throw new Error("--execute-planner is not supported for continue-run.");
    }
    if (!parsed.executeBuilder && !parsed.executeReviewer && !parsed.planFix && !parsed.executeFix && !parsed.runChecks) {
      throw new Error("continue-run requires at least one phase flag.");
    }
    if (parsed.allowWrites && !parsed.executeBuilder && !parsed.executeFix) {
      throw new Error("--allow-writes requires at least one write-eligible continuation phase: --execute-builder or --execute-fix.");
    }
  }
  if (parsed.command === "init-project") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.projectName) {
      throw new Error("init-project requires <name>. Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
    }
    if (!parsed.workspaceArg) {
      throw new Error("init-project requires --workspace <path>. Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
    }
    if (parsed.configArg) {
      throw new Error("--config is not supported for init-project.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for init-project.");
    }
  }
  if (parsed.command === "report-run") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.runId) {
      throw new Error(
        "report-run requires <run-id>. Usage: agent-stage report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]"
      );
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.workspaceArg) {
      throw new Error("--workspace is not supported for report-run.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for report-run.");
    }
  }

  return parsed;
}

function renderHelpText(command?: string): string {
  if (command === "run") {
    return [
      "Usage: agent-stage run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--generate-report]",
      "",
      "Run options:",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --preset <name>          plan | build | review | fix-plan | full-readonly",
      "  --dry-run                Validates/records run without executing Codex or checks.",
      "  --execute-planner        Planner extraction mode (read-only Codex sandbox).",
      "  --execute-builder        Requires --execute-planner.",
      "  --execute-reviewer       Requires --execute-planner.",
      "  --plan-fix               Requires --execute-reviewer.",
      "  --execute-fix            Requires --plan-fix.",
      "  --run-checks             Runs configured checks from config when not dry-run.",
      "  --allow-writes           Enables workspace-write sandbox for builder/fix only (after safety pass).",
      "  --auto-chain             Stage E: bounded planner->builder->reviewer->review-to-fix with fix/reviewer retries.",
      "  --max-fix-attempts <n>   Auto-chain only. Integer 0..5 (default 1); 0 means stop on FIX_REQUIRED without fix execution.",
      "  --stream-codex           Streams raw Codex stdout/stderr live while still writing artefacts.",
      "  --generate-report        Generates run-report.md and run-report.json after run completion.",
      "",
      "Auto-chain limitations:",
      "  - Supported only for run.",
      "  - Incompatible with --preset and explicit phase flags.",
      "",
      "Safety:",
      "  - Planner/reviewer/review-to-fix stay read-only.",
      "  - Retry loop is hard bounded by --max-fix-attempts (0..5).",
      "  - No auto-commit or auto-push.",
      "  - --allow-writes requires writeSafety.enabled=true and passing check-write-safety.",
      "",
      "Auto-chain statuses:",
      "  - PASS | NEEDS_FIX | NEEDS_FIX_WRITE_DISABLED | MAX_FIX_ATTEMPTS_REACHED | CHECKS_FAILED | FAILED"
    ].join("\n");
  }

  if (command === "continue-run") {
    return [
      "Usage: agent-stage continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose] [--stream-codex] [--generate-report]",
      "",
      "Continuation options:",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --dry-run                Validates continuation without executing Codex or checks.",
      "  --execute-builder        Continue builder phase for this run.",
      "  --execute-reviewer       Continue reviewer phase for this run.",
      "  --plan-fix               Continue fix planning phase for this run.",
      "  --execute-fix            Continue fix execution phase for this run.",
      "  --run-checks             Continue configured checks for this run.",
      "  --allow-writes           Enables workspace-write sandbox for builder/fix only (after safety pass).",
      "  --stream-codex           Streams raw Codex stdout/stderr live while still writing artefacts.",
      "  --generate-report        Regenerates run-report.md and run-report.json after continuation completion.",
      "",
      "Limitations:",
      "  - Planner continuation is not supported.",
      "  - --execute-planner and --preset are not supported for continue-run.",
      "  - At least one continuation phase flag is required.",
      "",
      "Safety:",
      "  - Planner/reviewer/review-to-fix stay read-only.",
      "  - No auto-commit or auto-push."
    ].join("\n");
  }

  if (command === "list-runs") {
    return [
      "Usage: agent-stage list-runs --config <config-path>",
      "",
      "Lists run directories and metadata summaries from the configured runs root.",
      "  --config <config-path>   Required. No implicit default is used."
    ].join("\n");
  }

  if (command === "show-run") {
    return [
      "Usage: agent-stage show-run <run-id> --config <config-path>",
      "",
      "Shows run metadata, status summaries, and artefact files for a run id.",
      "  --config <config-path>   Required. No implicit default is used."
    ].join("\n");
  }

  if (command === "open-run") {
    return [
      "Usage: agent-stage open-run <run-id> --config <config-path>",
      "",
      "Resolves a run directory and opens it on macOS (read-only inspection helper).",
      "  --config <config-path>   Required. No implicit default is used."
    ].join("\n");
  }

  if (command === "report-run") {
    return [
      "Usage: agent-stage report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]",
      "",
      "Generates AI Change Report artefacts for an existing run.",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --json                   Prints JSON-only report to stdout (machine-readable).",
      "  --pr-summary             Also generates pr-summary.md based on the ChangeReport.",
      "  --stdout-only            Prints report output without writing artefacts.",
      "  --force                  Overwrite existing run-report.md, run-report.json, and pr-summary.md.",
      "",
      "Notes:",
      "  - Does not execute Codex.",
      "  - Does not run checks.",
      "  - Does not mutate target workspace.",
      "  - Default writes run-report.md and run-report.json and prints a human summary.",
      "  - --pr-summary also writes pr-summary.md.",
      "  - --stdout-only prints Markdown by default.",
      "  - --pr-summary --stdout-only prints PR summary Markdown only.",
      "  - --json output is JSON-only (no progress logs or summary lines).",
      "  - --json --pr-summary --stdout-only is rejected because stdout can contain only one machine-readable format.",
      "  - Does not create a PR and does not call GitHub APIs.",
      "  - Reads existing run artefacts only; does not run git commands."
    ].join("\n");
  }

  if (command === "init-project") {
    return [
      "Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]",
      "",
      "Creates orchestrator-side project scaffolding without writing to target workspace.",
      "",
      "Options:",
      "  --workspace <path>       Required target repository path for validation only.",
      "  --force                  Overwrite generated orchestrator files if they exist.",
      "",
      "Safety:",
      "  - Target workspace is not modified.",
      "  - No auto-commit or auto-push."
    ].join("\n");
  }

  if (command === "check-write-safety") {
    return [
      "Usage: agent-stage check-write-safety --config <config-path>",
      "",
      "Runs Stage P read-only write-safety readiness checks against target workspace.",
      "  --config <config-path>   Required. No implicit default is used.",
      "",
      "Safety:",
      "  - No Codex execution.",
      "  - No workspace writes.",
      "  - No git mutation, commit, or push."
    ].join("\n");
  }

  return [
    "Usage: agent-stage <command> [options]",
    "",
    "Commands:",
    "  run <stage-name> --config <config-path> [options]",
    "  continue-run <run-id> --config <config-path> [options]",
    "  list-runs --config <config-path>",
    "  show-run <run-id> --config <config-path>",
    "  open-run <run-id> --config <config-path>",
    "  report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]",
    "  init-project <name> --workspace <path> [--force] [--verbose]",
    "  check-write-safety --config <config-path>",
    "",
    "Use \"agent-stage <command> --help\" for command details.",
    "",
    "Safety defaults:",
    "  - Codex runs in read-only sandbox.",
    "  - No auto-commit or auto-push.",
    "  - Write-enabled execution requires explicit --allow-writes and write-safety pass."
  ].join("\n");
}

export async function runCheckWriteSafety(
  configArg: string,
  orchestratorRoot: string,
  progressLogger: ProgressLogger = NOOP_PROGRESS_LOGGER,
  git: GitInspectionClient = createGitInspectionClient()
): Promise<CheckWriteSafetyRunResult> {
  progressLogger.phaseStart("write-safety", "loading config");
  const configPath = resolveConfigPath(orchestratorRoot, configArg);
  const config = await loadAndValidateConfig(configPath);
  progressLogger.phaseStart("write-safety", "inspecting git workspace");
  progressLogger.phaseStart("write-safety", "checking blocked paths");
  const result = await checkWriteSafety({
    workspaceRoot: config.workspaceRoot,
    config,
    git
  });
  if (result.ok) {
    progressLogger.phaseComplete("write-safety", "passed");
  } else {
    progressLogger.phaseFailed("write-safety", "write safety checks failed");
  }
  return {
    configPath,
    workspaceRoot: config.workspaceRoot,
    result
  };
}

function formatWriteSafetySummaryLines(outcome: CheckWriteSafetyRunResult): string[] {
  const { result } = outcome;
  const lines = [
    "Write safety summary",
    `- config path: ${outcome.configPath}`,
    `- workspace root: ${outcome.workspaceRoot}`,
    `- writeSafety.enabled: ${result.enabled}`,
    `- git work tree: ${result.isGitWorkTree}`,
    `- branch: ${result.branch || "(unknown)"}`,
    `- working tree: ${result.workingTreeState}`,
    `- changed files considered: ${result.changedFiles.length}`,
    `- blocked path matches: ${result.matchedBlockedPaths.length}`,
    `- result: ${result.ok ? "PASS" : "FAIL"}`
  ];

  if (result.warnings.length > 0) {
    lines.push("- warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (result.failures.length > 0) {
    lines.push("- failures:");
    for (const failure of result.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  if (result.matchedBlockedPaths.length > 0) {
    lines.push("- blocked path matches detail:");
    for (const match of result.matchedBlockedPaths) {
      lines.push(`  - ${match}`);
    }
  }

  return lines;
}

function formatInitProjectSummaryLines(result: Awaited<ReturnType<typeof initProject>>, orchestratorRoot: string): string[] {
  const configDisplay = path.relative(orchestratorRoot, result.configPath) || result.configPath;
  return [
    "Project initialization summary",
    `- project name: ${result.projectName}`,
    `- project slug: ${result.projectSlug}`,
    `- workspace path: ${result.workspacePath}`,
    `- config path: ${result.configPath}`,
    `- stages path: ${result.stagesPath}`,
    `- runs path: ${result.runsPath}`,
    `- example run command: npm run agent -- run example-stage --config ${configDisplay} --preset plan --dry-run`
  ];
}

function formatContinueSummaryLines(result: Awaited<ReturnType<typeof continueRun>>): string[] {
  return [
    "Continuation summary",
    `- run id: ${result.runId}`,
    `- run directory: ${result.runDir}`,
    `- config path: ${result.configPath}`,
    `- selected continuation phases: ${result.selectedPhases.join(", ")}`,
    `- dry-run: ${result.dryRun}`,
    `- allowWrites: ${result.allowWrites}`,
    `- write safety: ${result.writeSafetyState}`,
    `- write-enabled phases selected: ${result.writeEnabledPhases.length > 0 ? result.writeEnabledPhases.join(", ") : "none"}`,
    `- phase statuses before: planner=${result.before.planner}, builder=${result.before.builder}, reviewer=${result.before.reviewer}, fixPlanning=${result.before.fixPlanning}, fixExecution=${result.before.fixExecution}, checks=${result.before.checks}`,
    `- phase statuses after: planner=${result.after.planner}, builder=${result.after.builder}, reviewer=${result.after.reviewer}, fixPlanning=${result.after.fixPlanning}, fixExecution=${result.after.fixExecution}, checks=${result.after.checks}`,
    `- fix execution skip due to PROCEED: ${result.skippedFixBecauseProceed}`,
    `- artefacts written: ${result.artefacts.length}`
  ];
}

export function formatSummaryLines(
  result: SummaryResult,
  preset: PipelinePreset | undefined,
  executePlanner: boolean,
  executeBuilder: boolean,
  executeReviewer: boolean,
  planFix: boolean,
  executeFix: boolean,
  runChecks: boolean,
  allowWrites: boolean,
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run",
  writeEnabledPhases: Array<"builder" | "fix">
): string[] {
  const lines = [
    "Run summary",
    `- stage name: ${result.stageName}`,
    `- orchestrator root: ${result.orchestratorRoot}`,
    `- target workspace root: ${result.targetWorkspaceRoot}`,
    `- config path: ${result.configPath}`,
    `- run directory: ${result.runDir}`,
    `- preset: ${preset ?? "none"}`,
    `- resolved execution flags: executePlanner=${executePlanner}, executeBuilder=${executeBuilder}, executeReviewer=${executeReviewer}, planFix=${planFix}, executeFix=${executeFix}, runChecks=${runChecks}, dryRun=${result.dryRun}, allowWrites=${allowWrites}`,
    `- write safety: ${writeSafetyState}`,
    `- write-enabled phases selected: ${writeEnabledPhases.length > 0 ? writeEnabledPhases.join(", ") : "none"}`,
    "- artefacts written:"
  ];

  for (const artefact of result.artefacts) {
    lines.push(`  - ${artefact}`);
  }

  const plannerState = !executePlanner ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  const builderState = !executeBuilder ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  const reviewerState = !executeReviewer ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  const fixPlanningState = !planFix ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  let fixExecutionState = "disabled";
  if (executeFix) {
    if (result.dryRun) {
      fixExecutionState = "skipped by dry-run";
    } else if (result.artefacts.some((artefact) => artefact.endsWith("fix-exit.json"))) {
      fixExecutionState = "executed";
    } else if (result.artefacts.some((artefact) => artefact.endsWith("fix-skipped.json"))) {
      const skippedBecauseProceed = result.artefacts.some((artefact) => artefact.endsWith("review-to-fix-decision.proceed.json"));
      fixExecutionState = skippedBecauseProceed ? "skipped because proceed" : "disabled";
    }
  } else if (!result.dryRun && result.artefacts.some((artefact) => artefact.endsWith("fix-skipped.json"))) {
    fixExecutionState = "disabled";
  }

  lines.push(`- planner execution: ${plannerState}`);
  lines.push(`- builder execution: ${builderState}`);
  lines.push(`- reviewer execution: ${reviewerState}`);
  lines.push(`- fix planning: ${fixPlanningState}`);
  lines.push(`- fix execution: ${fixExecutionState}`);
  const checksState = !runChecks ? "disabled" : result.checksState;
  lines.push(`- target checks: ${checksState}`);
  if (result.dryRun && allowWrites && writeEnabledPhases.length > 0 && !executeReviewer) {
    lines.push("- post-write review: would be required when writes execute (add --execute-reviewer).");
  }
  lines.push("- note: planner/reviewer/review-to-fix remain read-only; git mutation/commit/push remains disabled.");

  return lines;
}

function formatRunDetailsLines(details: Awaited<ReturnType<typeof readRunDetails>>): string[] {
  const lines = [
    "Run details",
    `- run id: ${details.runId}`,
    `- run directory: ${details.runDir}`,
    `- project: ${details.projectName ?? "unknown"}`,
    `- stage: ${details.stageName ?? "unknown"}`,
    `- preset: ${details.preset ?? "none"}`,
    `- status: ${details.status}`,
    `- started at: ${details.startedAt ?? "unknown"}`,
    `- completed at: ${details.completedAt ?? "unknown"}`,
    `- stage input path: ${details.stageInputPath}`,
    `- planner execution status: ${details.statuses.planner}`,
    `- builder execution status: ${details.statuses.builder}`,
    `- reviewer execution status: ${details.statuses.reviewer}`,
    `- fix planning status: ${details.statuses.fixPlanning}`,
    `- fix execution status: ${details.statuses.fixExecution}`,
    `- checks status: ${details.statuses.checks}`,
  "- key status artefacts:"
  ];
  if (details.errorSummary) {
    lines.push(`- error summary: ${details.errorSummary}`);
  }
  for (const warning of details.warnings) {
    lines.push(`- warning: ${warning}`);
  }

  if (details.keyStatusArtefacts.length === 0) {
    lines.push("  - none");
  } else {
    for (const fileName of details.keyStatusArtefacts) {
      lines.push(`  - ${fileName}`);
    }
  }

  lines.push("- artefact files:");
  for (const fileName of details.artefacts) {
    lines.push(`  - ${fileName}`);
  }
  return lines;
}

function formatReportSummaryLines(
  report: Awaited<ReturnType<typeof generateChangeReport>>,
  runId: string,
  markdownPath: string,
  jsonPath: string,
  prSummaryPath: string | null
): string[] {
  const lines = [
    "AI Change Report",
    `- run id: ${runId}`,
    `- status: ${report.status}`,
    `- score: ${report.score}/100`,
    `- risk: ${report.risk}`,
    `- changed files: ${report.changedFiles.length}`,
    `- untracked files: ${report.untrackedFiles.length}`,
    `- scope drift warnings: ${report.scopeDriftWarnings.length}`,
    `- report markdown: ${markdownPath}`,
    `- report json: ${jsonPath}`
  ];
  if (prSummaryPath) {
    lines.push(`- PR summary markdown: ${prSummaryPath}`);
  }
  return lines;
}

async function generateReportSummaryLines(input: {
  runDir: string;
  progressLogger: ProgressLogger;
}): Promise<string[]> {
  input.progressLogger.info("[report] generating AI Change Report");
  const report = await generateChangeReport({ runDir: input.runDir });
  const { markdownPath, jsonPath } = await writeChangeReport({ runDir: input.runDir, report });
  input.progressLogger.info("[report] completed");
  return formatGeneratedReportSummaryLines(report, markdownPath, jsonPath);
}

function formatGeneratedReportSummaryLines(
  report: Awaited<ReturnType<typeof generateChangeReport>>,
  markdownPath: string,
  jsonPath: string
): string[] {
  return [
    "AI Change Report",
    `- status: ${report.status}`,
    `- score: ${report.score}/100`,
    `- risk: ${report.risk}`,
    `- changed files: ${report.changedFiles.length}`,
    `- untracked files: ${report.untrackedFiles.length}`,
    `- scope drift warnings: ${report.scopeDriftWarnings.length}`,
    `- report markdown: ${markdownPath}`,
    `- report json: ${jsonPath}`
  ];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertPathExists(targetPath: string, message: string): Promise<void> {
  try {
    await access(targetPath);
  } catch {
    throw new Error(message);
  }
}

export async function defaultOpenRunDirectory(runDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [runDir], { stdio: "ignore", shell: false });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to open run directory with open. code=${code ?? "null"} signal=${signal ?? "null"}`));
      }
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith("cli.js")) {
  void main();
}
