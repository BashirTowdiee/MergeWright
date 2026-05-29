import type { Stage, StagePlan } from "./stage-plan.js";

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "- (none)";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function renderDependsOn(dependsOn: string[]): string {
  return dependsOn.length > 0 ? dependsOn.join(", ") : "-";
}

function renderStageRow(stage: Stage): string {
  return `| ${stage.index} | ${stage.id} | ${stage.title} | ${stage.status} | ${stage.revision} | ${renderDependsOn(stage.dependsOn)} |`;
}

function renderStageDetail(stage: Stage): string {
  const contractLines = renderContractSummary(stage);
  const lines = [
    `## Stage ${stage.index}: ${stage.title}`,
    `- id: ${stage.id}`,
    `- goal: ${stage.goal}`,
    `- status: ${stage.status}`,
    `- revision: ${stage.revision}`,
    `- dependsOn: ${renderDependsOn(stage.dependsOn)}`,
    "",
    "### Assumptions",
    renderList(stage.assumptions),
    "",
    "### Acceptance Criteria",
    renderList(stage.acceptanceCriteria),
    "",
    "### Checks",
    renderList(stage.checks),
    "",
    "### Expected Outputs",
    renderList(stage.expectedOutputs),
    "",
    "### Scope Include",
    renderList(stage.scope.include),
    "",
    "### Scope Exclude",
    renderList(stage.scope.exclude),
    "",
    "### Contract",
    ...contractLines
  ];
  if (stage.commitSha !== undefined) {
    lines.push("", `- commitSha: ${stage.commitSha}`);
  }
  return lines.join("\n");
}

function renderContractSummary(stage: Stage): string[] {
  if (!stage.contract) {
    return ["- (none)"];
  }
  const lines = [
    "- allowedPaths:",
    ...renderNestedList(stage.contract.allowedPaths ?? []),
    "- forbiddenPaths:",
    ...renderNestedList(stage.contract.forbiddenPaths ?? []),
    "- requiredCommands:",
    ...renderNestedList(stage.contract.requiredCommands ?? []),
    "- requiredEvidence:",
    ...renderNestedList(stage.contract.requiredEvidence ?? []),
    "- review.checklist:",
    ...renderNestedList(stage.contract.review?.checklist ?? [])
  ];
  return lines;
}

function renderNestedList(items: string[]): string[] {
  if (items.length === 0) {
    return ["  - (none)"];
  }
  return items.map((item) => `  - ${item}`);
}

export function renderStagePlanMarkdown(plan: StagePlan): string {
  const lines = [
    `# ${plan.title}`,
    "",
    `- goal: ${plan.goal}`,
    `- source: ${plan.source}`,
    `- status: ${plan.status}`,
    `- schema version: ${plan.schemaVersion}`,
    `- createdAt: ${plan.createdAt}`,
    `- updatedAt: ${plan.updatedAt}`,
    `- stage count: ${plan.stages.length}`,
    "",
    "## Stages",
    "",
    "| index | id | title | status | revision | dependsOn |",
    "| --- | --- | --- | --- | --- | --- |",
    ...plan.stages.map(renderStageRow),
    "",
    ...plan.stages.map(renderStageDetail).join("\n\n").split("\n")
  ];
  return `${lines.join("\n")}\n`;
}
