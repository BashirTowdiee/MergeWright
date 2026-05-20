import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Stage, StagePlan } from "../../../stage-plan.js";

export function buildReassessmentPrompt(
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

export async function loadSourceStageChangeContext(stagePlanDir: string, sourceStage: Stage): Promise<string> {
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
