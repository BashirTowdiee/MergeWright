import type { FileScope } from "./file-scope.js";
import type { FocusedPane } from "./focus.js";
import type { PhaseNodeViewModel, RunDetailViewModel } from "./view-models.js";

export interface FocusBreadcrumbInput {
  focusedPane: FocusedPane;
  selectedRun: RunDetailViewModel;
  selectedPhase?: PhaseNodeViewModel;
  fileScope: FileScope;
}

export function buildFocusBreadcrumb(input: FocusBreadcrumbInput): string {
  return [
    "Focus",
    formatPane(input.focusedPane),
    `Run ${input.selectedRun.id}`,
    `Phase ${input.selectedPhase?.label ?? "none"}`,
    `Files ${input.fileScope}`
  ].join(" > ");
}

function formatPane(pane: FocusedPane): string {
  switch (pane) {
    case "runs":
      return "Runs";
    case "phases":
      return "Phase flow";
    case "actions":
      return "Safe action";
    case "artefacts":
      return "Files";
    case "findings":
      return "Review findings";
  }
}
