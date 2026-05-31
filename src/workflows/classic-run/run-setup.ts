import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { writeEvidenceManifest } from "../../evidence/evidence-store.js";
import { createAgentExecutor } from "../../execution-backends/agent-executor.js";
import { loadPromptTemplates } from "../../prompts.js";
import { loadAndValidateConfig, resolveConfigPath, validateWorkspaceSafety } from "../../config.js";
import {
  createInitialRunMetadata,
  type ResolvedRunOptions,
  type RunMetadata
} from "../../run-metadata.js";
import type { ProgressLogger } from "../../progress-logger.js";
import type { RunOptions } from "../../runner.js";
import {
  buildTemplateVariables,
  type ClassicRunContext,
  type ClassicRunExecutionOptions
} from "./run-context.js";
import { createInitialClassicRunEvidenceManifest } from "./run-evidence.js";

export async function prepareClassicRunContext(
  options: RunOptions,
  progressLogger: ProgressLogger
): Promise<ClassicRunContext> {
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  progressLogger.phaseStart("setup", "loading config");
  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const executor = createAgentExecutor(config, {
    overrideAgentExecutor: options.codexExecutor
  });
  progressLogger.verbose(`Config: ${configPath}`);

  const targetWorkspaceRoot = path.resolve(options.repoOverride ?? config.workspaceRoot);
  progressLogger.info(`Target: ${targetWorkspaceRoot}`);
  progressLogger.phaseStart("setup", "validating workspace");
  await validateWorkspaceSafety(targetWorkspaceRoot, config.safety.requireGitRepo);

  const stagesDir = path.resolve(orchestratorRoot, config.paths.stagesDir);
  const promptsDir = path.resolve(orchestratorRoot, config.paths.promptsDir);
  const runsBaseDir = resolveAndValidateRunsBaseDir(
    orchestratorRoot,
    targetWorkspaceRoot,
    config.paths.runsDir,
    config.projectName
  );

  const stagePath = path.resolve(stagesDir, `${options.stageName}.md`);
  progressLogger.phaseStart("setup", "loading stage file");
  const stageInstruction = await readRequired(stagePath, "stage file");
  progressLogger.phaseStart("setup", "rendering prompts");
  const templates = await loadPromptTemplates(promptsDir);
  progressLogger.verbose(`Stage file: ${stagePath}`);
  progressLogger.verbose(`Prompts dir: ${promptsDir}`);

  const timestamp = makeTimestamp();
  const runId = `${timestamp}-${options.stageName}`;
  const runDir = path.resolve(runsBaseDir, runId);
  progressLogger.phaseStart("setup", "creating run directory");
  await mkdir(runDir, { recursive: true });

  const variables = buildTemplateVariables({
    stageName: options.stageName,
    stageInstruction,
    timestamp,
    workspaceRoot: targetWorkspaceRoot,
    runDir
  });

  const context: ClassicRunContext = {
    orchestratorRoot,
    configPath,
    config,
    executor,
    targetWorkspaceRoot,
    stagesDir,
    promptsDir,
    runsBaseDir,
    stagePath,
    stageInstruction,
    templates,
    timestamp,
    runId,
    runDir,
    variables
  };

  await writeEvidenceManifest(runDir, createInitialClassicRunEvidenceManifest(context));
  progressLogger.phaseComplete("setup", `run directory: ${runDir}`);

  return context;
}

export function createInitialClassicRunMetadata(input: {
  options: RunOptions;
  context: ClassicRunContext;
  executionOptions: ClassicRunExecutionOptions;
}): RunMetadata {
  const { options, context, executionOptions } = input;
  const resolvedOptions: ResolvedRunOptions = {
    dryRun: options.dryRun,
    allowWrites: executionOptions.allowWrites,
    executePlanner: executionOptions.executePlanner,
    executeBuilder: executionOptions.executeBuilder,
    executeReviewer: executionOptions.executeReviewer,
    planFix: executionOptions.planFix,
    executeFix: executionOptions.executeFix,
    runChecks: executionOptions.runChecks
  };

  const metadata = createInitialRunMetadata({
    runId: context.runId,
    projectName: context.config.projectName,
    stageName: options.stageName,
    preset: options.preset,
    workspaceRoot: context.targetWorkspaceRoot,
    orchestratorRoot: context.orchestratorRoot,
    configPath: context.configPath,
    resolvedOptions
  });

  metadata.writeSafety = {
    state: options.dryRun && executionOptions.allowWrites ? "skipped by dry-run" : "not checked",
    allowWrites: executionOptions.allowWrites
  };
  metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
  metadata.postWriteReview = metadata.postWriteReview ?? {
    required: false,
    status: "not-required",
    reason: "no write-enabled builder/fix executed",
    requiredByPhases: [],
    artefacts: []
  };
  if (executionOptions.allowWrites && executionOptions.writeEnabledPhases.length > 0) {
    metadata.postWriteReview = {
      required: true,
      status: options.dryRun ? "not-required" : "pending",
      reason: "write-enabled builder/fix executed",
      requiredByPhases: executionOptions.writeEnabledPhases.map((phase) => (phase === "builder" ? "builder" : "fixExecution")),
      artefacts: options.dryRun ? [] : ["post-write-review-required.json", "post-write-review-status.json"]
    };
  }

  return metadata;
}

function resolveAndValidateRunsBaseDir(
  orchestratorRoot: string,
  targetWorkspaceRoot: string,
  configuredRunsDir: string,
  projectName: string
): string {
  const resolved = path.resolve(orchestratorRoot, configuredRunsDir);
  const relToOrchestrator = path.relative(orchestratorRoot, resolved);
  if (relToOrchestrator.startsWith("..") || path.isAbsolute(relToOrchestrator)) {
    throw new Error(
      `Invalid config: paths.runsDir must resolve inside orchestrator root ${orchestratorRoot}. Resolved: ${resolved}`
    );
  }

  const relToTarget = path.relative(targetWorkspaceRoot, resolved);
  if (!(relToTarget.startsWith("..") || path.isAbsolute(relToTarget))) {
    throw new Error(
      `Invalid config: paths.runsDir must not resolve inside target workspace ${targetWorkspaceRoot}. Resolved: ${resolved}`
    );
  }

  const projectSegment = normalizeProjectNameForRunPath(projectName);
  const expectedCurrent = path.resolve(orchestratorRoot, ".artifacts", "runs", projectSegment);
  const expectedLegacy = path.resolve(orchestratorRoot, "runs", projectSegment);
  if (resolved !== expectedCurrent && resolved !== expectedLegacy) {
    throw new Error(
      `Invalid config: paths.runsDir must resolve to .artifacts/runs/<projectName> (or legacy runs/<projectName>). Expected: ${expectedCurrent}. Resolved: ${resolved}`
    );
  }

  return resolved;
}

function normalizeProjectNameForRunPath(projectName: string): string {
  return projectName.trim().toLowerCase();
}

async function readRequired(filePath: string, kind: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing ${kind}: ${filePath}. ${msg}`);
  }
}

function makeTimestamp(date = new Date()): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}
