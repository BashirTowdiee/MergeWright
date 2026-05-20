import type { ReviewFindingViewModel } from "./view-models.js";

export function buildFindingDetailLines(finding: ReviewFindingViewModel | undefined): string[] {
  if (!finding) {
    return ["No finding selected."];
  }

  return [
    `Severity: ${finding.severity}`,
    `Message: ${finding.message}`,
    `Source: ${finding.sourceArtefactId ?? "unknown"}`
  ];
}
