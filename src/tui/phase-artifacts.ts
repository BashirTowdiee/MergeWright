import type { ArtefactViewModel, PhaseNodeViewModel } from "./view-models.js";

export function filterArtifactsForPhase(input: {
  artifacts: ArtefactViewModel[];
  selectedPhase?: PhaseNodeViewModel;
}): ArtefactViewModel[] {
  if (!input.selectedPhase) {
    return input.artifacts;
  }

  const phaseArtifactIds = new Set(input.selectedPhase.artefactIds);
  if (phaseArtifactIds.size === 0) {
    return [];
  }

  return input.artifacts.filter((artifact) => phaseArtifactIds.has(artifact.id) || artifact.phaseId === input.selectedPhase?.id);
}

export function formatArtifactScopeLabel(selectedPhase: PhaseNodeViewModel | undefined): string {
  return selectedPhase ? `Artifacts for ${selectedPhase.label}` : "Artifacts";
}
