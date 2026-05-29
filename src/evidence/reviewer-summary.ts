import { parseReviewerOutput } from "../reviewer-output.js";
import type { EvidenceAcceptanceSummary, EvidenceIssueSummary, EvidenceReviewSummary } from "./evidence-manifest.js";

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

export function createEvidenceAcceptanceSummary(input: { markdown: string }): EvidenceAcceptanceSummary | undefined {
  try {
    const decision = parseReviewerOutput(input.markdown);
    if (!decision.acceptanceCriteria || decision.acceptanceCriteria.length === 0) {
      return undefined;
    }
    const criteria = decision.acceptanceCriteria.map((item) => ({
      criterion: item.criterion,
      status: item.status,
      ...(item.evidence ? { evidence: item.evidence } : {})
    }));
    const status = criteria.every((item) => item.status === "pass")
      ? "pass"
      : criteria.some((item) => item.status === "fail")
        ? "fail"
        : "unknown";
    return { status, criteria };
  } catch {
    return undefined;
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
