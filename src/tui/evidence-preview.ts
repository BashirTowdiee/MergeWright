import type { ArtefactViewModel, ReviewFindingViewModel } from "./view-models.js";

export function buildEvidencePreview(input: {
  artefact?: ArtefactViewModel;
  findings: ReviewFindingViewModel[];
}): string[] {
  if (input.artefact) {
    return [
      `Artefact: ${input.artefact.title}`,
      `Kind: ${input.artefact.kind}`,
      `Path: ${input.artefact.path}`,
      input.artefact.phaseId ? `Phase: ${input.artefact.phaseId}` : "Phase: unknown",
      input.artefact.sizeBytes == null ? "Size: unknown" : `Size: ${input.artefact.sizeBytes} bytes`
    ];
  }

  if (input.findings.length > 0) {
    return input.findings.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`);
  }

  return ["No evidence selected."];
}
