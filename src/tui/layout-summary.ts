import type { RunDetailViewModel, RunListItemViewModel } from "./view-models.js";

export interface TuiLayoutSummaryInput {
  runs: RunListItemViewModel[];
  selectedRun: RunDetailViewModel;
}

export function buildLayoutSummary(input: TuiLayoutSummaryInput): string {
  const warningCount = input.selectedRun.warnings.length;
  return [
    `${input.runs.length} runs`,
    `${input.selectedRun.phases.length} phases`,
    `${input.selectedRun.safeActions.length} actions`,
    `${input.selectedRun.artefacts.length} artefacts`,
    `${input.selectedRun.reviewerFindings.length} findings`,
    `${warningCount} warnings`
  ].join(" · ");
}
