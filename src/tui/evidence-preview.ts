import type { ArtefactViewModel, ReviewFindingViewModel } from "./view-models.js";

export interface EvidenceSnippet {
  artefactId: string;
  lines: string[];
}

export function buildEvidencePreview(input: {
  artefact?: ArtefactViewModel;
  findings: ReviewFindingViewModel[];
  snippets?: Record<string, EvidenceSnippet>;
}): string[] {
  if (input.artefact) {
    const metadataLines = [
      `Artefact: ${input.artefact.title}`,
      `Kind: ${input.artefact.kind}`,
      `Path: ${input.artefact.path}`,
      input.artefact.phaseId ? `Phase: ${input.artefact.phaseId}` : "Phase: unknown",
      input.artefact.sizeBytes == null ? "Size: unknown" : `Size: ${input.artefact.sizeBytes} bytes`
    ];
    const snippet = input.snippets?.[input.artefact.id];
    if (!snippet || snippet.lines.length === 0) {
      return metadataLines;
    }
    return [...metadataLines, "", "Snippet:", ...snippet.lines];
  }

  if (input.findings.length > 0) {
    return input.findings.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`);
  }

  return ["No evidence selected."];
}

export function createEvidenceSnippet(input: { artefactId: string; content: string; maxLines?: number; maxLineLength?: number }): EvidenceSnippet {
  const maxLines = input.maxLines ?? 8;
  const maxLineLength = input.maxLineLength ?? 120;
  const lines = input.content
    .split(/\r?\n/)
    .slice(0, maxLines)
    .map((line) => truncateLine(line, maxLineLength));
  return { artefactId: input.artefactId, lines };
}

function truncateLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) {
    return line;
  }
  return `${line.slice(0, Math.max(0, maxLength - 1))}…`;
}
