export function formatNoPendingStagesSummaryLines(): string[] {
  return [
    "No pending stages.",
    "",
    "All stages are accepted or committed."
  ];
}

export function formatDryRunStageSummaryLines(stageId: string | undefined, stagePlanPath: string): string[] {
  return [
    `Dry run: would run stage ${stageId}.`,
    `Stage Plan: ${stagePlanPath}`
  ];
}

export function formatStageCompletedSummaryLines(
  stageId: string | undefined,
  status: string | undefined,
  stagePlanStatus: string | undefined,
  stageArtefactsDir: string | undefined
): string[] {
  return [
    "Stage completed and requires review.",
    "",
    `Stage: ${stageId}`,
    `Status: ${status}`,
    `Stage Plan Status: ${stagePlanStatus}`,
    `Artefacts: ${stageArtefactsDir}`,
    "",
    "Next:",
    `  accept-stage ${stageId}`,
    `  fix-stage ${stageId} --feedback "..."`
  ];
}

export function formatRunStageDryRunSummaryLines(stageId: string, stagePlanPath: string, stageArtefactsDir: string): string[] {
  return [
    "Dry run succeeded.",
    `Stage: ${stageId}`,
    `Would run using stage plan: ${stagePlanPath}`,
    `Would write artefacts: ${stageArtefactsDir}`
  ];
}

export function formatRunStageCompletedSummaryLines(stageId: string, status: string, stageArtefactsDir: string, stagePlanPath: string): string[] {
  return [
    "Stage completed and requires review.",
    "",
    `Stage: ${stageId}`,
    `Status: ${status}`,
    `Artefacts: ${stageArtefactsDir}`,
    `Stage Plan: ${stagePlanPath}`
  ];
}

export function formatFixStageCompletedSummaryLines(
  stageId: string,
  status: string,
  revision: string | number,
  feedbackPath: string,
  stagePlanPath: string,
  reassessment: { downstreamStageIds: string[]; reassessmentDir?: string | null } | undefined
): string[] {
  const lines = [
    "Stage fix completed and requires review.",
    "",
    `Stage: ${stageId}`,
    `Status: ${status}`,
    `Revision: ${revision}`,
    `Feedback: ${feedbackPath}`,
    `Stage Plan: ${stagePlanPath}`
  ];
  if (reassessment) {
    lines.push(`Reassessed downstream stages: ${reassessment.downstreamStageIds.length}`);
    if (reassessment.reassessmentDir) {
      lines.push(`Reassessment Artefacts: ${reassessment.reassessmentDir}`);
    }
  }
  return lines;
}
