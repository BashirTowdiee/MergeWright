export interface RunComparisonView {
  readonly version: 1;
  readonly runA: ComparedRunSummaryView;
  readonly runB: ComparedRunSummaryView;
  readonly deltas: {
    readonly score: number;
    readonly risk: "higher" | "lower" | "same";
    readonly readinessChanged: boolean;
    readonly checksChanged: boolean;
    readonly reviewerChanged: boolean;
    readonly changedFileCount: number;
  };
  readonly changedFiles: {
    readonly onlyInA: readonly string[];
    readonly onlyInB: readonly string[];
    readonly inBothCount: number;
  };
  readonly checks: {
    readonly failedOnlyInA: readonly string[];
    readonly failedOnlyInB: readonly string[];
  };
  readonly acceptance: {
    readonly regressions: readonly string[];
    readonly improvements: readonly string[];
  };
}

export interface ComparedRunSummaryView {
  readonly runId: string;
  readonly status: "READY" | "NEEDS_REVIEW" | "NEEDS_FIX" | "BLOCKED";
  readonly score: number;
  readonly risk: "low" | "medium" | "high";
  readonly reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  readonly checksState: "passed" | "failed" | "skipped" | "unknown";
  readonly changedFileCount: number;
  readonly acceptanceCriteria: {
    readonly expected: number;
    readonly passed: number;
    readonly failed: number;
    readonly unknown: number;
  };
  readonly missingEvidenceWarnings: readonly string[];
}
