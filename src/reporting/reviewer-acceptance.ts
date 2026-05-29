import type { EvidenceStageContract } from "../evidence/evidence-manifest.js";
import type { ReviewerAcceptanceCriterionResult } from "../reviewer-output.js";

export interface AcceptanceCriteriaSummary {
  expected: number;
  passed: number;
  failed: number;
  unknown: number;
  results: Array<{
    criterion: string;
    status: "pass" | "fail" | "unknown";
    evidence?: string;
    source: "reviewer" | "missing";
  }>;
}

export function summarizeReviewerAcceptanceCriteria(input: {
  stageContract: EvidenceStageContract | null;
  reviewerAcceptanceCriteria: ReviewerAcceptanceCriterionResult[] | undefined;
}): AcceptanceCriteriaSummary {
  const expectedCriteria = dedupeSort(input.stageContract?.acceptanceCriteria ?? []);
  if (expectedCriteria.length === 0) {
    return { expected: 0, passed: 0, failed: 0, unknown: 0, results: [] };
  }

  const byCriterion = new Map(
    (input.reviewerAcceptanceCriteria ?? []).map((item) => [normalizeCriterion(item.criterion), item] as const)
  );

  const results = expectedCriteria.map((criterion) => {
    const reviewerMatch = byCriterion.get(normalizeCriterion(criterion));
    if (!reviewerMatch) {
      return {
        criterion,
        status: "unknown" as const,
        source: "missing" as const
      };
    }
    return {
      criterion,
      status: reviewerMatch.status,
      source: "reviewer" as const,
      ...(reviewerMatch.evidence ? { evidence: reviewerMatch.evidence } : {})
    };
  });

  return {
    expected: expectedCriteria.length,
    passed: results.filter((item) => item.status === "pass").length,
    failed: results.filter((item) => item.status === "fail").length,
    unknown: results.filter((item) => item.status === "unknown").length,
    results
  };
}

function normalizeCriterion(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort((a, b) =>
    a.localeCompare(b)
  );
}
