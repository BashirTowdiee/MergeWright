import path from "node:path";
import { access } from "node:fs/promises";
import { loadAndValidateConfig, resolveConfigPath } from "../config.js";
import {
  buildAndValidateOpenCodeReadOnlyCommand,
  probeOpenCodeCliContract,
  validateOpenCodeProbeCommand
} from "../execution-backends/opencode-cli-contract.js";
import { formatChangeReportJson, formatChangeReportMarkdown, formatPrSummaryMarkdown, generateChangeReport, writeChangeReport } from "../change-report.js";
import type { continueRun } from "../continue-run.js";
import type { initProject } from "../init-project.js";
import { resolveRunsRoot, type readRunDetails } from "../runs.js";
import type { ProgressLogger } from "../progress-logger.js";
import type { CheckWriteSafetyRunResult, ParsedArgs, SummaryResult } from "./types.js";
import type { PipelinePreset } from "../presets.js";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function assertPathExists(targetPath: string, message: string): Promise<void> {
  try {
    await access(targetPath);
  } catch {
    throw new Error(message);
  }
}

export function formatWriteSafetySummaryLines(outcome: CheckWriteSafetyRunResult): string[] {
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

export function formatInitProjectSummaryLines(result: Awaited<ReturnType<typeof initProject>>, orchestratorRoot: string): string[] {
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

export function formatContinueSummaryLines(result: Awaited<ReturnType<typeof continueRun>>): string[] {
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

export function formatRunDetailsLines(details: Awaited<ReturnType<typeof readRunDetails>>): string[] {
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

export function formatReportSummaryLines(
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

export async function generateReportSummaryLines(input: {
  runDir: string;
  progressLogger: ProgressLogger;
  policy: Awaited<ReturnType<typeof loadAndValidateConfig>>["changeReport"];
}): Promise<string[]> {
  input.progressLogger.info("[report] generating AI Change Report");
  const report = await generateChangeReport({ runDir: input.runDir, policy: input.policy });
  const { markdownPath, jsonPath } = await writeChangeReport({ runDir: input.runDir, report });
  input.progressLogger.info("[report] completed");
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

export async function runProbeOpenCodeCommand(args: ParsedArgs, orchestratorRoot: string) {
  const commandFromArgs = args.opencodeCommand;
  if (commandFromArgs) {
    validateOpenCodeProbeCommand(commandFromArgs);
  }
  let resolvedCommand: string | undefined;
  if (args.configArg) {
    const configPath = resolveConfigPath(orchestratorRoot, args.configArg);
    const config = await loadAndValidateConfig(configPath);
    if (args.backendName) {
      const backend = config.executionBackends[args.backendName];
      if (!backend) {
        throw new Error(`Configured backend "${args.backendName}" was not found in executionBackends.`);
      }
      if (backend.type !== "opencode-cli") {
        throw new Error(`Configured backend "${args.backendName}" is type "${backend.type}", expected "opencode-cli".`);
      }
      resolvedCommand = backend.command ?? "opencode";
    } else {
      const firstOpenCodeBackend = Object.values(config.executionBackends).find((backend) => backend.type === "opencode-cli");
      resolvedCommand = firstOpenCodeBackend?.command ?? undefined;
    }
  } else if (args.backendName) {
    throw new Error("--backend requires --config because backends are loaded from config.");
  }

  const command = commandFromArgs ?? resolvedCommand ?? "opencode";
  validateOpenCodeProbeCommand(command);
  const probe = await probeOpenCodeCliContract({ command, timeoutMs: 15_000 });

  let readOnlyCommandValidation: { ok: boolean; errors: string[]; warnings: string[] } | undefined;
  if (args.validateReadonlyContract) {
    const validation = buildAndValidateOpenCodeReadOnlyCommand({
      request: {
        prompt: "probe",
        role: "planner",
        model: "probe-model",
        workspaceRoot: process.cwd(),
        outputLastMessagePath: path.resolve(process.cwd(), ".shepherds-staff-opencode-probe-output.md"),
        orchestratorRoot: process.cwd(),
        dryRun: true,
        command
      },
      contract: probe.contract
    });
    readOnlyCommandValidation = validation.validation;
  }

  return {
    ok: probe.ok && (readOnlyCommandValidation?.ok ?? true),
    command,
    probe,
    readOnlyCommandValidation
  };
}

export async function loadConfigAndRunsRoot(orchestratorRoot: string, configArg: string) {
  const configPath = resolveConfigPath(orchestratorRoot, configArg);
  const config = await loadAndValidateConfig(configPath);
  const runsRoot = resolveRunsRoot(orchestratorRoot, config);
  return { configPath, config, runsRoot };
}

export { formatChangeReportJson, formatChangeReportMarkdown, formatPrSummaryMarkdown, generateChangeReport, writeChangeReport, resolveConfigPath, loadAndValidateConfig };
