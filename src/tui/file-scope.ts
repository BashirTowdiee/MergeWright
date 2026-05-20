import type { ArtefactViewModel, PhaseNodeViewModel } from "./view-models.js";
import { filterArtifactsForPhase, formatArtifactScopeLabel } from "./phase-artifacts.js";

export type FileScope = "phase" | "all";

export function toggleFileScope(scope: FileScope): FileScope {
  return scope === "phase" ? "all" : "phase";
}

export function resolveScopedFiles(input: {
  scope: FileScope;
  files: ArtefactViewModel[];
  selectedPhase?: PhaseNodeViewModel;
}): ArtefactViewModel[] {
  if (input.scope === "all") {
    return input.files;
  }

  return filterArtifactsForPhase({ artifacts: input.files, selectedPhase: input.selectedPhase });
}

export function formatFileScopeLabel(input: { scope: FileScope; selectedPhase?: PhaseNodeViewModel }): string {
  if (input.scope === "all") {
    return "All files";
  }

  return formatArtifactScopeLabel(input.selectedPhase);
}
