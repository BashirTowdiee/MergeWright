import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Stage, StagePlan } from "../../../stage-plan.js";
import type { ReassessmentResult } from "./reassessment-result-parser.js";

export async function resolveReassessmentDir(stagePlanDir: string, sourceStageId: string, revision: number): Promise<string> {
  const base = path.join(stagePlanDir, "reassessments", sourceStageId);
  const preferred = path.join(base, `revision-${revision}`);
  if (!(await pathExists(preferred))) {
    return preferred;
  }
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(base, `revision-${revision}-${suffix}`);
}

export async function ensureReassessmentDir(stagePlanDir: string, sourceStageId: string, revision: number): Promise<string> {
  const reassessmentDir = await resolveReassessmentDir(stagePlanDir, sourceStageId, revision);
  await mkdir(reassessmentDir, { recursive: true });
  return reassessmentDir;
}

export async function writeReassessmentPromptArtefact(reassessmentDir: string, prompt: string): Promise<string> {
  const promptPath = path.join(reassessmentDir, "reassessment-prompt.md");
  await writeFile(promptPath, prompt, "utf8");
  return promptPath;
}

export async function writeReassessmentResultArtefacts(args: {
  reassessmentDir: string;
  validResult: ReassessmentResult;
  report: string;
}): Promise<void> {
  await writeFile(path.join(args.reassessmentDir, "reassessment-result.json"), `${JSON.stringify(args.validResult, null, 2)}\n`, "utf8");
  await writeFile(path.join(args.reassessmentDir, "reassessment-report.md"), args.report, "utf8");
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
