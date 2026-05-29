import { parseReviewerOutput } from "../reviewer-output.js";
import type {
  EvidenceAcceptanceSummary,
  EvidenceCheckSummary,
  EvidenceIssueSummary,
  EvidenceReviewSummary,
  EvidenceTestObservation
} from "./evidence-manifest.js";

export function createEvidenceReviewerSummary(input: { markdown: string; artefactPath?: string }): EvidenceReviewSummary {
  try {
    const decision = parseReviewerOutput(input.markdown);
    return {
      verdict: decision.verdict,
      artefactPath: input.artefactPath,
      blockingIssues: decision.blockingIssues.map(toEvidenceIssueSummary),
      nonBlockingIssues: decision.nonBlockingIssues.map(toEvidenceIssueSummary),
      ...(decision.evidenceChecked ? { evidenceChecked: decision.evidenceChecked.map(toEvidenceCheckSummary) } : {}),
      ...(decision.testsObserved ? { testsObserved: decision.testsObserved.map(toEvidenceTestObservation) } : {}),
      ...(decision.riskLevel ? { riskLevel: decision.riskLevel } : {}),
      ...(decision.recommendedFixPrompt ? { recommendedFixPrompt: decision.recommendedFixPrompt } : {})
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

function toEvidenceCheckSummary(check: { artefact: string; status: "verified" | "missing" | "inconclusive"; note?: string }): EvidenceCheckSummary {
  return {
    artefact: check.artefact,
    status: check.status,
    ...(check.note ? { note: check.note } : {})
  };
}

function toEvidenceTestObservation(input: {
  test: string;
  outcome: "pass" | "fail" | "not_run" | "unknown";
  evidence?: string;
}): EvidenceTestObservation {
  return {
    test: input.test,
    outcome: input.outcome,
    ...(input.evidence ? { evidence: input.evidence } : {})
  };
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
