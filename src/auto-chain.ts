import path from "node:path";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { validateStageName } from "./stage.js";
import { NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";

export interface AutoChainDryRunOptions {
  stageName: string;
  configArg: string;
  orchestratorRoot: string;
  repoOverride?: string;
  allowWrites: boolean;
  streamCodex: boolean;
  maxFixAttempts: number;
  progressLogger?: ProgressLogger;
}

export interface AutoChainDryRunSummary {
  stageName: string;
  configPath: string;
  targetWorkspaceRoot: string;
  allowWrites: boolean;
  streamCodex: boolean;
  maxFixAttempts: number;
}

export async function projectAutoChainDryRun(options: AutoChainDryRunOptions): Promise<AutoChainDryRunSummary> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  progressLogger.phaseStart("auto-chain", "projecting flow");

  validateStageName(options.stageName);
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const targetWorkspaceRoot = path.resolve(options.repoOverride ?? config.workspaceRoot);

  progressLogger.phaseComplete("auto-chain", "dry-run complete");
  return {
    stageName: options.stageName,
    configPath,
    targetWorkspaceRoot,
    allowWrites: options.allowWrites,
    streamCodex: options.streamCodex,
    maxFixAttempts: options.maxFixAttempts
  };
}

export function formatAutoChainDryRunSummaryLines(summary: AutoChainDryRunSummary): string[] {
  const projectionLines = buildAutoChainProjectionLines(summary.maxFixAttempts);
  return [
    "Auto-chain dry-run summary",
    "",
    `stage name: ${summary.stageName}`,
    `config path: ${summary.configPath}`,
    `target workspace root: ${summary.targetWorkspaceRoot}`,
    `allowWrites: ${summary.allowWrites}`,
    `streamCodex: ${summary.streamCodex}`,
    `max fix attempts: ${summary.maxFixAttempts}`,
    "",
    "Projected flow:",
    "",
    ...projectionLines,
    "",
    "No Codex execution, checks, git mutation, commit, push, or merge occurred."
  ];
}

export function buildAutoChainProjectionLines(maxFixAttempts: number): string[] {
  const lines: string[] = [
    "1. planner",
    "2. builder",
    "3. reviewer",
    "4. review-to-fix",
    "5. if PROCEED: checks"
  ];

  if (maxFixAttempts === 0) {
    lines.push("6. if FIX_REQUIRED: stop without fix execution because max fix attempts is 0");
    return lines;
  }

  let index = 6;
  for (let attempt = 1; attempt <= maxFixAttempts; attempt += 1) {
    const attemptPrefix = attempt === 1 ? "if FIX_REQUIRED: " : "if still FIX_REQUIRED: ";
    lines.push(`${index}. ${attemptPrefix}fix attempt ${attempt}`);
    index += 1;
    lines.push(`${index}. reviewer retry after fix attempt ${attempt}`);
    index += 1;
  }

  lines.push(`${index}. checks if reviewer passes`);
  lines.push(`${index + 1}. stop when PASS, checks fail, or max fix attempts is reached`);
  return lines;
}
