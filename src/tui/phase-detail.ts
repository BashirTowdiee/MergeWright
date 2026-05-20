import type { PhaseNodeViewModel } from "./view-models.js";

export function buildPhaseDetailLines(phase: PhaseNodeViewModel | undefined): string[] {
  if (!phase) {
    return ["No phase selected."];
  }

  return [
    `Phase: ${phase.label}`,
    `Status: ${phase.status}`,
    phase.summary ? `Summary: ${phase.summary}` : "Summary: none",
    phase.blockedReason ? `Blocked: ${phase.blockedReason}` : "Blocked: no",
    `Artefacts: ${phase.artefactIds.length}`
  ];
}
