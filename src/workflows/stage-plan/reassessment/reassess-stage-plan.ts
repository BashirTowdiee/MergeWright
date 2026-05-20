import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentExecutionResult, AgentExecutor } from "../../../agent-executor.js";
import { loadAndValidateConfig, resolveConfigPath } from "../../../config.js";
import { createAgentExecutor } from "../../../execution-backends/agent-executor.js";
import { renderStagePlanMarkdown } from "../../../stage-plan-renderer.js";
import { readStagePlan, writeStagePlan } from "../../../stage-plan-store.js";
import { ensureReassessmentDir, renderReassessmentReport, writeReassessmentPromptArtefact, writeReassessmentResultArtefacts } from "./reassessment-artefacts.js";
import { getDownstreamStages, findStage } from "./downstream-selector.js";
import { buildReassessmentPrompt, loadSourceStageChangeContext } from "./reassessment-prompt.js";
import { parseReassessmentOutput, validateReassessmentResult } from "./reassessment-result-parser.js";
import { applyReassessmentResult } from "./reassessment-status-updater.js";
import type { Stage } from "../../../stage-plan.js";

export interface ReassessStagePlanOptions {
  stagePlanArg: string;
  sourceStageId: string;
  configArg: string;
  orchestratorRoot: string;
  dryRun: boolean;
  codexExecutor?: AgentExecutor;
}

export interface ReassessStagePlanResult {
  sourceStageId: string;
  sourceRevision: number;
  dryRun: boolean;
  stagePlanPath: string;
  reassessmentDir?: string;
  downstreamStageIds: string[];
  changedStatuses: Array<{ stageId: string; from: Stage["status"]; to: Stage["status"] }>;
  stagePlanStatusChanged: boolean;
}

export async function reassessStagePlan(options: ReassessStagePlanOptions): Promise<ReassessStagePlanResult> {
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const stagePlanPath = path.resolve(orchestratorRoot, options.stagePlanArg);
  const plan = await readStagePlan(stagePlanPath);
  const sourceStage = findStage(plan, options.sourceStageId);
  const downstreamStages = getDownstreamStages(plan, sourceStage.id);

  if (options.dryRun) {
    return {
      sourceStageId: sourceStage.id,
      sourceRevision: sourceStage.revision,
      dryRun: true,
      stagePlanPath,
      downstreamStageIds: downstreamStages.map((stage) => stage.id),
      changedStatuses: [],
      stagePlanStatusChanged: false
    };
  }

  if (downstreamStages.length === 0) {
    return {
      sourceStageId: sourceStage.id,
      sourceRevision: sourceStage.revision,
      dryRun: false,
      stagePlanPath,
      downstreamStageIds: [],
      changedStatuses: [],
      stagePlanStatusChanged: false
    };
  }

  const stagePlanDir = path.dirname(stagePlanPath);
  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);

  const reassessmentDir = await ensureReassessmentDir(stagePlanDir, sourceStage.id, sourceStage.revision);

  const sourceChangeContext = await loadSourceStageChangeContext(stagePlanDir, sourceStage);
  const prompt = buildReassessmentPrompt(plan, sourceStage, downstreamStages, sourceChangeContext);
  await writeReassessmentPromptArtefact(reassessmentDir, prompt);

  const outputPath = path.join(reassessmentDir, "reassessment-output-last-message.md");
  const executor = options.codexExecutor ?? createAgentExecutor(config);
  const execution = await executor({
    prompt,
    role: "reviewer",
    model: config.codex.reviewer.model,
    reasoningEffort: config.codex.reviewer.reasoningEffort,
    workspaceRoot: path.resolve(config.workspaceRoot),
    outputLastMessagePath: outputPath,
    dryRun: false,
    requireGitRepo: config.safety.requireGitRepo,
    orchestratorRoot,
    sandboxMode: "read-only"
  });

  if (!execution.success) {
    throw buildExecutionError(execution);
  }

  const parsed = parseReassessmentOutput(execution.outputLastMessage);
  const valid = validateReassessmentResult(plan, sourceStage.id, parsed, downstreamStages);

  const apply = applyReassessmentResult(plan, valid, sourceStage.id);
  if (apply.changedStatuses.length > 0 || apply.stagePlanStatusChanged) {
    plan.updatedAt = new Date().toISOString();
    await writeStagePlan(stagePlanPath, plan);
    await writeFile(path.join(stagePlanDir, "stage-plan.md"), renderStagePlanMarkdown(plan), "utf8");
  }

  const report = renderReassessmentReport({
    plan,
    sourceStage,
    downstreamStages,
    result: valid,
    changedStatuses: apply.changedStatuses
  });

  await writeReassessmentResultArtefacts({
    reassessmentDir,
    validResult: valid,
    report
  });

  return {
    sourceStageId: sourceStage.id,
    sourceRevision: sourceStage.revision,
    dryRun: false,
    stagePlanPath,
    reassessmentDir,
    downstreamStageIds: downstreamStages.map((stage) => stage.id),
    changedStatuses: apply.changedStatuses,
    stagePlanStatusChanged: apply.stagePlanStatusChanged
  };
}

function buildExecutionError(execution: AgentExecutionResult): Error {
  const details = [
    `Reassessment execution failed with exit code ${execution.exitCode ?? "null"}.`,
    execution.stderr.trim() ? `stderr: ${execution.stderr.trim()}` : undefined
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
  return new Error(details);
}
