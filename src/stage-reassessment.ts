import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeCodex, type CodexExecutionResult, type CodexExecutor } from "./codex.js";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { renderStagePlanMarkdown } from "./stage-plan-renderer.js";
import { readStagePlan, writeStagePlan } from "./stage-plan-store.js";
import type { Stage, StagePlan } from "./stage-plan.js";

export type ReassessmentClassification = "unchanged" | "needs_revision" | "invalidated";

export interface ReassessmentResultItem {
  stageId: string;
  classification: ReassessmentClassification;
  reason: string;
}

export interface ReassessmentResult {
  sourceStageId: string;
  results: ReassessmentResultItem[];
}

export interface ReassessStagePlanOptions {
  stagePlanArg: string;
  sourceStageId: string;
  configArg: string;
  orchestratorRoot: string;
  dryRun: boolean;
  codexExecutor?: CodexExecutor;
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

export function getDownstreamStages(plan: StagePlan, sourceStageId: string): Stage[] {
  const source = findStage(plan, sourceStageId);
  const byId = new Map(plan.stages.map((stage) => [stage.id, stage] as const));

  const dependentIds = new Set<string>();
  const queue = [source.id];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    for (const stage of plan.stages) {
      if (dependentIds.has(stage.id) || stage.id === source.id) {
        continue;
      }
      if (stage.dependsOn.includes(currentId)) {
        dependentIds.add(stage.id);
        queue.push(stage.id);
      }
    }
  }

  const downstream = new Set<string>();
  for (const stage of plan.stages) {
    if (stage.id !== source.id && stage.index > source.index) {
      downstream.add(stage.id);
    }
  }
  for (const id of dependentIds) {
    downstream.add(id);
  }

  return [...downstream]
    .map((id) => byId.get(id))
    .filter((stage): stage is Stage => stage !== undefined)
    .sort((a, b) => a.index - b.index);
}

export function validateReassessmentResult(
  plan: StagePlan,
  sourceStageId: string,
  value: unknown,
  downstreamStagesInput?: Stage[]
): ReassessmentResult {
  const downstreamStages = downstreamStagesInput ?? getDownstreamStages(plan, sourceStageId);
  const downstreamById = new Map(downstreamStages.map((stage) => [stage.id, stage] as const));

  if (!isRecord(value)) {
    throw new Error("Reassessment result validation failed: JSON root must be an object.");
  }
  if (value.sourceStageId !== sourceStageId) {
    throw new Error(`Reassessment result validation failed: sourceStageId must equal "${sourceStageId}".`);
  }
  if (!Array.isArray(value.results)) {
    throw new Error('Reassessment result validation failed: "results" must be an array.');
  }

  const seen = new Set<string>();
  const results: ReassessmentResultItem[] = [];

  for (let i = 0; i < value.results.length; i += 1) {
    const item = value.results[i];
    if (!isRecord(item)) {
      throw new Error(`Reassessment result validation failed: results[${i}] must be an object.`);
    }
    const stageId = item.stageId;
    const classification = item.classification;
    const reason = item.reason;

    if (typeof stageId !== "string" || stageId.trim().length === 0) {
      throw new Error(`Reassessment result validation failed: results[${i}].stageId must be a non-empty string.`);
    }
    if (seen.has(stageId)) {
      throw new Error(`Reassessment result validation failed: duplicate stageId "${stageId}".`);
    }
    seen.add(stageId);

    if (!downstreamById.has(stageId)) {
      const existsInPlan = plan.stages.some((stage) => stage.id === stageId);
      if (existsInPlan) {
        throw new Error(`Reassessment result validation failed: stageId "${stageId}" is not downstream of "${sourceStageId}".`);
      }
      throw new Error(`Reassessment result validation failed: unknown result stageId "${stageId}".`);
    }

    if (classification !== "unchanged" && classification !== "needs_revision" && classification !== "invalidated") {
      throw new Error(
        `Reassessment result validation failed: results[${i}].classification must be one of unchanged, needs_revision, invalidated.`
      );
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new Error(`Reassessment result validation failed: results[${i}].reason must be non-empty.`);
    }

    results.push({ stageId, classification, reason: reason.trim() });
  }

  for (const stage of downstreamStages) {
    if (!seen.has(stage.id)) {
      throw new Error(`Reassessment result validation failed: missing downstream result for stage "${stage.id}".`);
    }
  }

  return {
    sourceStageId,
    results
  };
}

export function applyReassessmentResult(
  plan: StagePlan,
  result: ReassessmentResult,
  sourceStageId: string
): {
  changedStatuses: Array<{ stageId: string; from: Stage["status"]; to: Stage["status"] }>;
  stagePlanStatusChanged: boolean;
} {
  const source = findStage(plan, sourceStageId);
  const downstreamIds = new Set(getDownstreamStages(plan, source.id).map((stage) => stage.id));

  let hasBlockingDownstream = false;
  const changedStatuses: Array<{ stageId: string; from: Stage["status"]; to: Stage["status"] }> = [];

  const byId = new Map(plan.stages.map((stage) => [stage.id, stage] as const));
  for (const item of result.results) {
    if (!downstreamIds.has(item.stageId)) {
      continue;
    }
    const stage = byId.get(item.stageId);
    if (!stage) {
      continue;
    }

    if (item.classification === "needs_revision" || item.classification === "invalidated") {
      hasBlockingDownstream = true;
    }

    const nextStatus =
      item.classification === "unchanged"
        ? stage.status
        : item.classification === "needs_revision"
          ? "needs_revision"
          : "invalidated";

    if (nextStatus !== stage.status) {
      changedStatuses.push({ stageId: stage.id, from: stage.status, to: nextStatus });
      stage.status = nextStatus;
    }
  }

  let stagePlanStatusChanged = false;
  if (hasBlockingDownstream && plan.status !== "paused") {
    plan.status = "paused";
    stagePlanStatusChanged = true;
  }

  return { changedStatuses, stagePlanStatusChanged };
}

export function renderReassessmentReport(args: {
  plan: StagePlan;
  sourceStage: Stage;
  downstreamStages: Stage[];
  result: ReassessmentResult;
  changedStatuses: Array<{ stageId: string; from: Stage["status"]; to: Stage["status"] }>;
}): string {
  const byId = new Map(args.plan.stages.map((stage) => [stage.id, stage] as const));
  const changedById = new Map(args.changedStatuses.map((item) => [item.stageId, item] as const));

  const lines = [
    `# Reassessment Report: ${args.sourceStage.id}`,
    "",
    "## Source Stage",
    `- id: ${args.sourceStage.id}`,
    `- title: ${args.sourceStage.title}`,
    `- revision: ${args.sourceStage.revision}`,
    `- status: ${args.sourceStage.status}`,
    "",
    "## Downstream Stages Reviewed",
    ...args.downstreamStages.map((stage) => `- ${stage.id}: ${stage.title} [status=${stage.status}]`),
    "",
    "## Classifications"
  ];

  for (const item of args.result.results) {
    lines.push(`- ${item.stageId}: ${item.classification}`);
    lines.push(`  reason: ${item.reason}`);
    const change = changedById.get(item.stageId);
    if (change) {
      lines.push(`  status_change: ${change.from} -> ${change.to}`);
    } else {
      const stage = byId.get(item.stageId);
      lines.push(`  status_change: unchanged (${stage?.status ?? "unknown"})`);
    }
  }

  const hasBlocking = args.result.results.some(
    (item) => item.classification === "needs_revision" || item.classification === "invalidated"
  );
  lines.push("", "## Next Recommended Action");
  if (!hasBlocking) {
    lines.push("- No downstream stage changes required. Continue as planned.");
  } else {
    lines.push("- Resolve downstream stages marked needs_revision or invalidated before continuing stages.");
  }

  return `${lines.join("\n")}\n`;
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

  const reassessmentDir = await resolveReassessmentDir(stagePlanDir, sourceStage.id, sourceStage.revision);
  await mkdir(reassessmentDir, { recursive: true });

  const sourceChangeContext = await loadSourceStageChangeContext(stagePlanDir, sourceStage);
  const prompt = buildReassessmentPrompt(plan, sourceStage, downstreamStages, sourceChangeContext);
  const promptPath = path.join(reassessmentDir, "reassessment-prompt.md");
  await writeFile(promptPath, prompt, "utf8");

  const outputPath = path.join(reassessmentDir, "reassessment-output-last-message.md");
  const codexExecutor = options.codexExecutor ?? executeCodex;
  const execution = await codexExecutor(
    {
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
    }
  );

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

  await writeFile(path.join(reassessmentDir, "reassessment-result.json"), `${JSON.stringify(valid, null, 2)}\n`, "utf8");
  await writeFile(path.join(reassessmentDir, "reassessment-report.md"), report, "utf8");

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

function buildReassessmentPrompt(
  plan: StagePlan,
  sourceStage: Stage,
  downstreamStages: Stage[],
  sourceChangeContext: string
): string {
  const renderList = (items: string[]): string => (items.length === 0 ? "- (none)" : items.map((item) => `- ${item}`).join("\n"));
  const stageLines = downstreamStages
    .map((stage) => {
      const dependencies = stage.dependsOn.length === 0 ? "(none)" : stage.dependsOn.join(", ");
      return [
        `### ${stage.id}`,
        `- title: ${stage.title}`,
        `- index: ${stage.index}`,
        `- status: ${stage.status}`,
        `- revision: ${stage.revision}`,
        `- dependsOn: ${dependencies}`,
        `- goal: ${stage.goal}`,
        "- assumptions:",
        renderList(stage.assumptions),
        "- acceptanceCriteria:",
        renderList(stage.acceptanceCriteria)
      ].join("\n");
    })
    .join("\n\n");

  return [
    `# Stage Plan: ${plan.title}`,
    "",
    "## Task",
    "Classify every downstream stage after a source stage revision.",
    "",
    "## Source Stage",
    `- id: ${sourceStage.id}`,
    `- title: ${sourceStage.title}`,
    `- revision: ${sourceStage.revision}`,
    `- status: ${sourceStage.status}`,
    `- goal: ${sourceStage.goal}`,
    "- assumptions:",
    renderList(sourceStage.assumptions),
    "- acceptanceCriteria:",
    renderList(sourceStage.acceptanceCriteria),
    "",
    "## Source Stage Change Context",
    sourceChangeContext,
    "",
    "## Downstream Stages",
    stageLines,
    "",
    "## Guardrails",
    "- Classification-only task.",
    "- Do not implement code.",
    "- Do not modify files.",
    "- Do not rewrite downstream stage definitions.",
    "- Do not propose a new implementation plan.",
    "- Only classify each downstream stage as unchanged, needs_revision, or invalidated.",
    "- Return only the requested structured JSON.",
    "- Every downstream stage must have exactly one result.",
    "- Reasons must be concise and tied to source-stage changes or assumptions.",
    "",
    "## Required Output",
    "Return only structured JSON. No markdown. No prose. No code fences.",
    `- sourceStageId must be \"${sourceStage.id}\".`,
    "- results must contain exactly one entry for every downstream stage listed above.",
    "- stageId must match one downstream stage id.",
    "- classification must be one of: unchanged, needs_revision, invalidated.",
    "- reason must be a non-empty string.",
    "",
    "Output schema:",
    "{",
    '  "sourceStageId": "...",',
    '  "results": [',
    "    {",
    '      "stageId": "...",',
    '      "classification": "unchanged|needs_revision|invalidated",',
    '      "reason": "..."',
    "    }",
    "  ]",
    "}"
  ].join("\n");
}

async function loadSourceStageChangeContext(stagePlanDir: string, sourceStage: Stage): Promise<string> {
  const stageArtefactsDir = path.join(stagePlanDir, "stages", sourceStage.id);
  const artefacts = await readSourceContextArtefacts(stageArtefactsDir, sourceStage.revision);
  if (artefacts.length === 0) {
    return "- (no stage artefact context available)";
  }
  return artefacts.join("\n");
}

async function readSourceContextArtefacts(stageArtefactsDir: string, revision: number): Promise<string[]> {
  const preferredFeedback = `feedback-revision-${revision}.md`;
  const candidates = [
    "stage-report.md",
    preferredFeedback,
    "reviewer-output.md",
    "builder-output.md",
    "feedback.md"
  ];
  const sections: string[] = [];
  for (const fileName of candidates) {
    const filePath = path.join(stageArtefactsDir, fileName);
    const excerpt = await readArtefactExcerpt(filePath, 600);
    if (!excerpt) {
      continue;
    }
    sections.push(`- ${fileName}: ${excerpt}`);
  }
  return sections;
}

async function readArtefactExcerpt(filePath: string, maxChars: number): Promise<string | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    const oneLine = raw.replace(/\s+/g, " ").trim();
    if (!oneLine) {
      return "(empty)";
    }
    if (oneLine.length <= maxChars) {
      return oneLine;
    }
    return `${oneLine.slice(0, maxChars)}...`;
  } catch {
    return undefined;
  }
}

async function resolveReassessmentDir(stagePlanDir: string, sourceStageId: string, revision: number): Promise<string> {
  const base = path.join(stagePlanDir, "reassessments", sourceStageId);
  const preferred = path.join(base, `revision-${revision}`);
  if (!(await pathExists(preferred))) {
    return preferred;
  }
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(base, `revision-${revision}-${suffix}`);
}

function parseReassessmentOutput(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Reassessment output parse error: empty model output.");
  }

  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Reassessment output parse error: invalid JSON. ${message}`);
  }
}

function buildExecutionError(execution: CodexExecutionResult): Error {
  const details = [
    `Reassessment execution failed with exit code ${execution.exitCode ?? "null"}.`,
    execution.stderr.trim() ? `stderr: ${execution.stderr.trim()}` : undefined
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
  return new Error(details);
}

function findStage(plan: StagePlan, stageId: string): Stage {
  const stage = plan.stages.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`Unknown stage id "${stageId}" in stage plan "${plan.id}".`);
  }
  return stage;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
