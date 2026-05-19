import type { readRunDetails } from "../../runs.js";

export function formatRunDetailsLines(details: Awaited<ReturnType<typeof readRunDetails>>): string[] {
  const lines = [
    "Run details",
    `- run id: ${details.runId}`,
    `- run directory: ${details.runDir}`,
    `- project: ${details.projectName ?? "unknown"}`,
    `- stage: ${details.stageName ?? "unknown"}`,
    `- preset: ${details.preset ?? "none"}`,
    `- status: ${details.status}`,
    `- started at: ${details.startedAt ?? "unknown"}`,
    `- completed at: ${details.completedAt ?? "unknown"}`,
    `- stage input path: ${details.stageInputPath}`,
    `- planner execution status: ${details.statuses.planner}`,
    `- builder execution status: ${details.statuses.builder}`,
    `- reviewer execution status: ${details.statuses.reviewer}`,
    `- fix planning status: ${details.statuses.fixPlanning}`,
    `- fix execution status: ${details.statuses.fixExecution}`,
    `- checks status: ${details.statuses.checks}`,
    "- key status artefacts:"
  ];
  if (details.errorSummary) {
    lines.push(`- error summary: ${details.errorSummary}`);
  }
  for (const warning of details.warnings) {
    lines.push(`- warning: ${warning}`);
  }
  if (details.keyStatusArtefacts.length === 0) {
    lines.push("  - none");
  } else {
    for (const fileName of details.keyStatusArtefacts) {
      lines.push(`  - ${fileName}`);
    }
  }
  lines.push("- artefact files:");
  for (const fileName of details.artefacts) {
    lines.push(`  - ${fileName}`);
  }
  return lines;
}
