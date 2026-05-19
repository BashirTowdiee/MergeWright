import path from "node:path";
import { access } from "node:fs/promises";
import { loadAndValidateConfig, resolveConfigPath } from "../config.js";
import {
  buildAndValidateOpenCodeReadOnlyCommand,
  probeOpenCodeCliContract,
  validateOpenCodeProbeCommand
} from "../execution-backends/opencode-cli-contract.js";
import { formatChangeReportJson, formatChangeReportMarkdown, formatPrSummaryMarkdown, generateChangeReport, writeChangeReport } from "../change-report.js";
import { resolveRunsRoot } from "../runs.js";
import type { ProgressLogger } from "../progress-logger.js";
import type { ParsedArgs } from "./types.js";
import { formatGeneratedReportSummaryLines } from "./output/report-summary.js";

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

export async function generateReportSummaryLines(input: {
  runDir: string;
  progressLogger: ProgressLogger;
  policy: Awaited<ReturnType<typeof loadAndValidateConfig>>["changeReport"];
}): Promise<string[]> {
  input.progressLogger.info("[report] generating AI Change Report");
  const report = await generateChangeReport({ runDir: input.runDir, policy: input.policy });
  const { markdownPath, jsonPath } = await writeChangeReport({ runDir: input.runDir, report });
  input.progressLogger.info("[report] completed");
  return formatGeneratedReportSummaryLines(report, markdownPath, jsonPath);
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
export { formatContinueSummaryLines } from "./output/continue-run-summary.js";
export { formatInitProjectSummaryLines } from "./output/init-project-summary.js";
export { formatWriteSafetySummaryLines } from "./output/write-safety-summary.js";
export { formatRunDetailsLines } from "./output/run-details-summary.js";
export { formatReportSummaryLines, formatGeneratedReportSummaryLines } from "./output/report-summary.js";
