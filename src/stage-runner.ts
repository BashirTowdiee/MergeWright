import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProgressLogger } from "./progress-logger.js";
import { NOOP_PROGRESS_LOGGER } from "./progress-logger.js";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { runStage, type RunResult } from "./runner.js";
import { renderStagePlanMarkdown } from "./stage-plan-renderer.js";
import { readStagePlan, writeStagePlan } from "./stage-plan-store.js";
import type { Stage, StagePlan } from "./stage-plan.js";
import { assertDependencyReady, assertRunnableStage } from "./stage-status.js";

export interface RunStagePlanOptions {
  stageId: string;
  stagePlanArg: string;
  configArg: string;
  orchestratorRoot: string;
  allowWrites: boolean;
  dryRun: boolean;
  verbose: boolean;
  streamCodex: boolean;
  progressLogger?: ProgressLogger;
  runHandler?: typeof runStage;
}

export interface RunStagePlanResult {
  stageId: string;
  status: "review_required";
  stagePlanPath: string;
  stageArtefactsDir: string;
  dryRun: boolean;
}

export async function runSingleStageFromPlan(options: RunStagePlanOptions): Promise<RunStagePlanResult> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const stagePlanPath = path.resolve(orchestratorRoot, options.stagePlanArg);
  const plan = await readStagePlan(stagePlanPath);
  const stage = findStage(plan, options.stageId);
  assertRunnableStage(stage);
  validateDependencies(plan, stage);

  const stagePlanDir = path.dirname(stagePlanPath);
  const stageArtefactsDir = path.resolve(stagePlanDir, "stages", stage.id);
  const stagePrompt = buildStagePrompt(plan, stage);

  if (options.dryRun) {
    progressLogger.info(`[run-stage] dry-run: validated stage "${stage.id}"`);
    return {
      stageId: stage.id,
      status: "review_required",
      stagePlanPath,
      stageArtefactsDir,
      dryRun: true
    };
  }

  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-"));
  const tmpStagesDir = path.join(tmpRoot, "stages");
  const tmpConfigPath = path.join(tmpRoot, "config.run-stage.json");
  const runHandler = options.runHandler ?? runStage;

  await mkdir(tmpStagesDir, { recursive: true });
  await writeFile(path.join(tmpStagesDir, `${stage.id}.md`), stagePrompt, "utf8");
  await writeFile(
    tmpConfigPath,
    `${JSON.stringify({ ...config, paths: { ...config.paths, stagesDir: tmpStagesDir } }, null, 2)}\n`,
    "utf8"
  );

  let executionStarted = false;
  try {
    await mkdir(stageArtefactsDir, { recursive: true });
    await writeJson(path.join(stageArtefactsDir, "stage.json"), stage);
    await writeFile(path.join(stageArtefactsDir, "stage-prompt.md"), stagePrompt, "utf8");

    executionStarted = true;
    const runResult = await runHandler({
      stageName: stage.id,
      configArg: tmpConfigPath,
      dryRun: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: true,
      runChecks: true,
      allowWrites: options.allowWrites,
      streamCodex: options.streamCodex,
      verbose: options.verbose,
      orchestratorRoot,
      progressLogger
    });

    await writePhaseOutputs(stageArtefactsDir, runResult.runDir);
    await writeStageReport({
      stageArtefactsDir,
      plan,
      stage,
      runDir: runResult.runDir,
      finalStatus: "review_required",
      failure: undefined
    });

    stage.status = "review_required";
    plan.updatedAt = new Date().toISOString();
    await writeStagePlan(stagePlanPath, plan);
    await writeFile(path.join(stagePlanDir, "stage-plan.md"), renderStagePlanMarkdown(plan), "utf8");

    return {
      stageId: stage.id,
      status: "review_required",
      stagePlanPath,
      stageArtefactsDir,
      dryRun: false
    };
  } catch (error) {
    if (executionStarted) {
      stage.status = "failed";
      plan.updatedAt = new Date().toISOString();
      await writeStagePlan(stagePlanPath, plan);
      await writeFile(path.join(stagePlanDir, "stage-plan.md"), renderStagePlanMarkdown(plan), "utf8");
      await writeStageReport({
        stageArtefactsDir,
        plan,
        stage,
        runDir: undefined,
        finalStatus: "failed",
        failure: error
      });
    }
    throw error;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

function findStage(plan: StagePlan, stageId: string): Stage {
  const stage = plan.stages.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`Unknown stage id "${stageId}" in stage plan "${plan.id}".`);
  }
  return stage;
}

function validateDependencies(plan: StagePlan, stage: Stage): void {
  const byId = new Map(plan.stages.map((item) => [item.id, item] as const));
  for (const depId of stage.dependsOn) {
    const dep = byId.get(depId);
    if (!dep) {
      continue;
    }
    assertDependencyReady(stage, dep);
  }
}

function buildStagePrompt(plan: StagePlan, stage: Stage): string {
  const dependencySection = stage.dependsOn
    .map((depId) => plan.stages.find((s) => s.id === depId))
    .filter((stageDep): stageDep is Stage => stageDep !== undefined)
    .map((dep) => `- ${dep.id}: ${dep.title} [status=${dep.status}] goal=${dep.goal}`)
    .join("\n");

  const renderList = (items: string[]): string => (items.length === 0 ? "- (none)" : items.map((item) => `- ${item}`).join("\n"));

  return [
    `# Stage Plan: ${plan.title}`,
    "",
    "## Plan Goal",
    plan.goal,
    "",
    "## Current Stage",
    `- id: ${stage.id}`,
    `- title: ${stage.title}`,
    `- goal: ${stage.goal}`,
    "",
    "## Assumptions",
    renderList(stage.assumptions),
    "",
    "## Acceptance Criteria",
    renderList(stage.acceptanceCriteria),
    "",
    "## Expected Outputs",
    renderList(stage.expectedOutputs),
    "",
    "## Checks",
    renderList(stage.checks),
    "",
    "## Scope Include",
    renderList(stage.scope.include),
    "",
    "## Scope Exclude",
    renderList(stage.scope.exclude),
    "",
    "## Dependency Stage Summaries",
    dependencySection || "- (none)",
    "",
    "## Constraints",
    `- Only stage "${stage.id}" is in scope for this run.`,
    "- Do not implement future stages.",
    "- Stop after reviewer/check results and human review handoff."
  ].join("\n");
}

async function writePhaseOutputs(stageArtefactsDir: string, runDir: string): Promise<void> {
  await copyIfExists(path.join(runDir, "06-planner-output-last-message.md"), path.join(stageArtefactsDir, "planner-output.md"));
  await copyIfExists(path.join(runDir, "builder-output-last-message.md"), path.join(stageArtefactsDir, "builder-output.md"));
  await copyIfExists(path.join(runDir, "reviewer-output-last-message.md"), path.join(stageArtefactsDir, "reviewer-output.md"));

  const checksStatusPath = path.join(runDir, "checks-status.json");
  try {
    const raw = await readFile(checksStatusPath, "utf8");
    await writeFile(path.join(stageArtefactsDir, "checks-output.txt"), raw, "utf8");
  } catch {
    // checks may be disabled or unavailable; keep stage artefact set best-effort
  }
}

async function copyIfExists(fromPath: string, toPath: string): Promise<void> {
  try {
    const content = await readFile(fromPath, "utf8");
    await writeFile(toPath, content, "utf8");
  } catch {
    // optional artefact
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeStageReport(args: {
  stageArtefactsDir: string;
  plan: StagePlan;
  stage: Stage;
  runDir?: string;
  finalStatus: "review_required" | "failed";
  failure?: unknown;
}): Promise<void> {
  const failureMessage =
    args.failure == null ? undefined : args.failure instanceof Error ? args.failure.message : String(args.failure);
  const lines = [
    `# Stage Report: ${args.stage.id}`,
    "",
    `- plan: ${args.plan.title}`,
    `- stage: ${args.stage.id} (${args.stage.title})`,
    `- status: ${args.finalStatus}`,
    `- revision: ${args.stage.revision}`,
    `- updatedAt: ${new Date().toISOString()}`,
    `- runDir: ${args.runDir ?? "(not available)"}`
  ];
  if (failureMessage) {
    lines.push(`- error: ${failureMessage}`);
  }
  lines.push(
    "",
    "## Artefacts",
    "- stage.json",
    "- stage-prompt.md",
    "- planner-output.md (if planner ran)",
    "- builder-output.md (if builder ran)",
    "- reviewer-output.md (if reviewer ran)",
    "- checks-output.txt (if checks ran)"
  );
  await writeFile(path.join(args.stageArtefactsDir, "stage-report.md"), `${lines.join("\n")}\n`, "utf8");
}

