import type { TuiSelectionContext } from "./selection-context-read-model.js";

export type TuiSelectionPreviewInput = {
  readonly artefact: TuiSelectionContext["selectedArtefact"];
  readonly findings: TuiSelectionContext["selectedRun"]["reviewerFindings"];
};

export function buildTuiSelectionPreviewInput(context: TuiSelectionContext): TuiSelectionPreviewInput {
  return {
    artefact: context.selectedArtefact,
    findings: context.selectedRun.reviewerFindings
  };
}
