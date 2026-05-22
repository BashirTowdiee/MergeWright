import type { FileScope } from "./file-scope.js";
import { resolveScopedFiles } from "./file-scope.js";
import type { TuiSelectionState } from "./selection-state.js";
import { resolveSelectedRunForTui } from "./selected-run-read-model.js";
import type { ArtefactViewModel, RunDetailViewModel, RunListItemViewModel } from "./view-models.js";

export type TuiSelectionContext = {
  readonly selectedRun: RunDetailViewModel;
  readonly selectedPhase: RunDetailViewModel["phases"][number] | undefined;
  readonly scopedArtefacts: readonly ArtefactViewModel[];
  readonly selectedArtefact: ArtefactViewModel | undefined;
  readonly selectedAction: RunDetailViewModel["safeActions"][number] | undefined;
  readonly selectedFinding: RunDetailViewModel["reviewerFindings"][number] | undefined;
  readonly navigationCounts: {
    readonly runs: number;
    readonly phases: number;
    readonly actions: number;
    readonly files: number;
    readonly findings: number;
  };
};

export type TuiSelectionContextInput = {
  readonly runs: readonly RunListItemViewModel[];
  readonly runDetailsById: Readonly<Record<string, RunDetailViewModel>>;
  readonly fallbackRun: RunDetailViewModel;
  readonly selection: TuiSelectionState;
  readonly fileScope: FileScope;
};

export function buildTuiSelectionContext(input: TuiSelectionContextInput): TuiSelectionContext {
  const selectedRun = resolveSelectedRunForTui({
    runs: input.runs,
    runDetailsById: input.runDetailsById,
    fallbackRun: input.fallbackRun,
    selectedRunIndex: input.selection.runIndex
  });
  const selectedPhase = selectedRun.phases[input.selection.phaseIndex];
  const scopedArtefacts = resolveScopedFiles({ scope: input.fileScope, files: selectedRun.artefacts, selectedPhase });

  return {
    selectedRun,
    selectedPhase,
    scopedArtefacts,
    selectedArtefact: scopedArtefacts[input.selection.fileIndex],
    selectedAction: selectedRun.safeActions[input.selection.actionIndex],
    selectedFinding: selectedRun.reviewerFindings[input.selection.findingIndex],
    navigationCounts: {
      runs: input.runs.length,
      phases: selectedRun.phases.length,
      actions: selectedRun.safeActions.length,
      files: scopedArtefacts.length,
      findings: selectedRun.reviewerFindings.length
    }
  };
}
