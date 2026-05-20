import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Stage, StagePlan } from "../../stage-plan.js";

export function buildStagePrompt(plan: StagePlan, stage: Stage): string {
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

export async function buildFixStagePrompt(plan: StagePlan, stage: Stage, feedback: string, stageArtefactsDir: string): Promise<string> {
  const dependencySection = stage.dependsOn
    .map((depId) => plan.stages.find((s) => s.id === depId))
    .filter((stageDep): stageDep is Stage => stageDep !== undefined)
    .map((dep) => `- ${dep.id}: ${dep.title} [status=${dep.status}] goal=${dep.goal}`)
    .join("\n");

  const renderList = (items: string[]): string => (items.length === 0 ? "- (none)" : items.map((item) => `- ${item}`).join("\n"));
  const artefactSummary = await readExistingArtefactSummaries(stageArtefactsDir);

  return [
    `# Stage Plan: ${plan.title}`,
    "",
    "## Stage Fix Request",
    `- id: ${stage.id}`,
    `- title: ${stage.title}`,
    `- goal: ${stage.goal}`,
    `- current_status: ${stage.status}`,
    `- current_revision: ${stage.revision}`,
    "",
    "## Human Feedback",
    feedback,
    "",
    "## Acceptance Criteria",
    renderList(stage.acceptanceCriteria),
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
    "## Assumptions",
    renderList(stage.assumptions),
    "",
    "## Dependency Stage Summaries",
    dependencySection || "- (none)",
    "",
    "## Existing Stage Artefact Summaries",
    artefactSummary,
    "",
    "## Constraints",
    `- Only stage "${stage.id}" is in scope for this fix.`,
    "- Implement only what is required to address the human feedback.",
    "- Do not implement future stages.",
    "- Do not rewrite unrelated areas.",
    "- Preserve previous artefacts where practical."
  ].join("\n");
}

async function readExistingArtefactSummaries(stageArtefactsDir: string): Promise<string> {
  const artefacts = ["planner-output.md", "builder-output.md", "reviewer-output.md", "checks-output.txt", "stage-report.md"];
  const summaries: string[] = [];
  for (const artefact of artefacts) {
    const filePath = path.join(stageArtefactsDir, artefact);
    try {
      const content = (await readFile(filePath, "utf8")).trim();
      const snippet = content.length <= 400 ? content : `${content.slice(0, 400)}...`;
      summaries.push(`- ${artefact}: ${snippet || "(empty)"}`);
    } catch {
      summaries.push(`- ${artefact}: (not available)`);
    }
  }
  return summaries.join("\n");
}

export function renderFeedbackFile(stage: Stage, feedback: string): string {
  return [
    `# Stage Feedback: ${stage.id}`,
    "",
    `- stage: ${stage.id} (${stage.title})`,
    `- prior_status: ${stage.status}`,
    `- prior_revision: ${stage.revision}`,
    `- recorded_at: ${new Date().toISOString()}`,
    "",
    "## Feedback",
    feedback
  ].join("\n") + "\n";
}

export function isFixableStageStatus(status: Stage["status"]): boolean {
  return status === "review_required" || status === "failed" || status === "fix_required" || status === "accepted";
}
