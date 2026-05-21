import { parseReviewerOutput } from "../reviewer-output.js";
import type { EvidenceIssueSummary, EvidenceReviewSummary } from "./evidence-manifest.js";

export function createEvidenceReviewerSummary(input: { markdown: string; artefactPath?: string }): EvidenceReviewSummary {
  try {
    const decision = parseReviewerOutput(input.markdown);
    return {
      verdict: decision.verdict,
      artefactPath: input.artefactPath,
      blockingIssues: decision.blockingIssues.map(toEvidenceIssueSummary),
      nonBlockingIssues: decision.nonBlockingIssues.map(toEvidenceIssueSummary)
    };
  } catch {
    return {
      verdict: "UNKNOWN",
      artefactPath: input.artefactPath,
      blockingIssues: [],
      nonBlockingIssues: []
    };
  }
}

function toEvidenceIssueSummary(issue: {
  severity: "low" | "medium" | "high";
  summary: string;
  files: string[];
}): EvidenceIssueSummary {
  return {
    severity: issue.severity,
    summary: issue.summary,
    files: issue.files
  };
}
