import { useMemo } from "react";
import type { RunListItemViewModel } from "../view-models.js";

export type RunStatusFilter = RunListItemViewModel["status"] | "all";

export interface UseRunsInput {
  runs: RunListItemViewModel[];
  statusFilter?: RunStatusFilter;
}

export function filterRunsByStatus(runs: RunListItemViewModel[], statusFilter: RunStatusFilter = "all"): RunListItemViewModel[] {
  if (statusFilter === "all") {
    return runs;
  }
  return runs.filter((run) => run.status === statusFilter);
}

export function useRuns({ runs, statusFilter = "all" }: UseRunsInput): RunListItemViewModel[] {
  return useMemo(() => filterRunsByStatus(runs, statusFilter), [runs, statusFilter]);
}
