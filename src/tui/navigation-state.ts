import type { FocusedPane } from "./focus.js";
import { moveSelection } from "./navigation.js";
import {
  selectAction,
  selectFile,
  selectFinding,
  selectPhase,
  selectRun,
  type TuiSelectionState
} from "./selection-state.js";

export interface NavigationCounts {
  runs: number;
  phases: number;
  actions: number;
  files: number;
  findings: number;
}

export function moveSelectionForFocusedPane(input: {
  focusedPane: FocusedPane;
  selection: TuiSelectionState;
  counts: NavigationCounts;
  direction: "up" | "down";
}): TuiSelectionState {
  switch (input.focusedPane) {
    case "runs":
      return selectRun(
        input.selection,
        moveSelection({ currentIndex: input.selection.runIndex, itemCount: input.counts.runs, direction: input.direction })
      );
    case "phases":
      return selectPhase(
        input.selection,
        moveSelection({ currentIndex: input.selection.phaseIndex, itemCount: input.counts.phases, direction: input.direction })
      );
    case "actions":
      return selectAction(
        input.selection,
        moveSelection({ currentIndex: input.selection.actionIndex, itemCount: input.counts.actions, direction: input.direction })
      );
    case "artefacts":
      return selectFile(
        input.selection,
        moveSelection({ currentIndex: input.selection.fileIndex, itemCount: input.counts.files, direction: input.direction })
      );
    case "findings":
      return selectFinding(
        input.selection,
        moveSelection({ currentIndex: input.selection.findingIndex, itemCount: input.counts.findings, direction: input.direction })
      );
  }
}

export function getNavigationNoticeForFocusedPane(focusedPane: FocusedPane): string | null {
  return focusedPane === "runs" ? "Selected run changed." : null;
}
