import type { RunDetailViewModel, RunListItemViewModel } from "./view-models.js";

export type SelectedRunReadModelInput = {
  readonly runs: readonly RunListItemViewModel[];
  readonly runDetailsById: Readonly<Record<string, RunDetailViewModel>>;
  readonly fallbackRun: RunDetailViewModel;
  readonly selectedRunIndex: number;
};

export function resolveSelectedRunForTui(input: SelectedRunReadModelInput): RunDetailViewModel {
  const selectedRunListItem = input.runs[input.selectedRunIndex];

  if (!selectedRunListItem) {
    return input.fallbackRun;
  }

  return input.runDetailsById[selectedRunListItem.id] ?? input.fallbackRun;
}
