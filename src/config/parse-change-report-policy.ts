import { DEFAULT_CHANGE_REPORT_POLICY, type ChangeReportPolicy } from "../change-report.js";
import { assertBoolean, assertNumber, assertObject, assertStringArray } from "../validation.js";

function assertOptionalBooleanWithDefault(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }
  return assertBoolean(value, field);
}

function assertOptionalStringArrayWithDefault(value: unknown, field: string, defaultValue: string[]): string[] {
  if (value == null) {
    return [...defaultValue];
  }
  const parsed = assertStringArray(value, field);
  for (let i = 0; i < parsed.length; i += 1) {
    if (!parsed[i].trim()) {
      throw new Error(`Invalid config: ${field}[${i}] must be a non-empty string`);
    }
  }
  return parsed;
}

function assertOptionalNumberWithDefault(value: unknown, field: string, defaultValue: number): number {
  if (value == null) {
    return defaultValue;
  }
  return assertNumber(value, field);
}

function assertScoreRange(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Invalid config: ${field} must be a number between 0 and 100`);
  }
}

function assertNonNegativePenalty(value: unknown, field: string, defaultValue: number): number {
  const parsed = value == null ? defaultValue : assertNumber(value, field);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`Invalid config: ${field} must be a number between 0 and 100`);
  }
  return parsed;
}

export { DEFAULT_CHANGE_REPORT_POLICY };

export function parseChangeReportPolicy(raw: Record<string, unknown>): ChangeReportPolicy {
  const riskRules = raw.riskRules == null ? {} : assertObject(raw.riskRules, "changeReport.riskRules");
  const scopeDrift = raw.scopeDrift == null ? {} : assertObject(raw.scopeDrift, "changeReport.scopeDrift");
  const readiness = raw.readiness == null ? {} : assertObject(raw.readiness, "changeReport.readiness");
  const penalties = readiness.penalties == null ? {} : assertObject(readiness.penalties, "changeReport.readiness.penalties");

  const readyMinimumScore = assertOptionalNumberWithDefault(
    readiness.readyMinimumScore,
    "changeReport.readiness.readyMinimumScore",
    DEFAULT_CHANGE_REPORT_POLICY.readiness.readyMinimumScore
  );
  const needsReviewMinimumScore = assertOptionalNumberWithDefault(
    readiness.needsReviewMinimumScore,
    "changeReport.readiness.needsReviewMinimumScore",
    DEFAULT_CHANGE_REPORT_POLICY.readiness.needsReviewMinimumScore
  );
  assertScoreRange(readyMinimumScore, "changeReport.readiness.readyMinimumScore");
  assertScoreRange(needsReviewMinimumScore, "changeReport.readiness.needsReviewMinimumScore");
  if (readyMinimumScore < needsReviewMinimumScore) {
    throw new Error(
      "Invalid config: changeReport.readiness.readyMinimumScore must be greater than or equal to changeReport.readiness.needsReviewMinimumScore"
    );
  }

  return {
    riskRules: {
      highRiskPaths: assertOptionalStringArrayWithDefault(
        riskRules.highRiskPaths,
        "changeReport.riskRules.highRiskPaths",
        DEFAULT_CHANGE_REPORT_POLICY.riskRules.highRiskPaths
      ),
      mediumRiskPaths: assertOptionalStringArrayWithDefault(
        riskRules.mediumRiskPaths,
        "changeReport.riskRules.mediumRiskPaths",
        DEFAULT_CHANGE_REPORT_POLICY.riskRules.mediumRiskPaths
      ),
      lowRiskPaths: assertOptionalStringArrayWithDefault(
        riskRules.lowRiskPaths,
        "changeReport.riskRules.lowRiskPaths",
        DEFAULT_CHANGE_REPORT_POLICY.riskRules.lowRiskPaths
      )
    },
    scopeDrift: {
      enabled: assertOptionalBooleanWithDefault(
        scopeDrift.enabled,
        "changeReport.scopeDrift.enabled",
        DEFAULT_CHANGE_REPORT_POLICY.scopeDrift.enabled
      ),
      allowUnlistedTestFiles: assertOptionalBooleanWithDefault(
        scopeDrift.allowUnlistedTestFiles,
        "changeReport.scopeDrift.allowUnlistedTestFiles",
        DEFAULT_CHANGE_REPORT_POLICY.scopeDrift.allowUnlistedTestFiles
      ),
      allowUnlistedDocsFiles: assertOptionalBooleanWithDefault(
        scopeDrift.allowUnlistedDocsFiles,
        "changeReport.scopeDrift.allowUnlistedDocsFiles",
        DEFAULT_CHANGE_REPORT_POLICY.scopeDrift.allowUnlistedDocsFiles
      )
    },
    readiness: {
      readyMinimumScore,
      needsReviewMinimumScore,
      penalties: {
        failedRun: assertNonNegativePenalty(
          penalties.failedRun,
          "changeReport.readiness.penalties.failedRun",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.failedRun
        ),
        reviewerFail: assertNonNegativePenalty(
          penalties.reviewerFail,
          "changeReport.readiness.penalties.reviewerFail",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.reviewerFail
        ),
        checksFailed: assertNonNegativePenalty(
          penalties.checksFailed,
          "changeReport.readiness.penalties.checksFailed",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.checksFailed
        ),
        checksSkippedWithSourceChanges: assertNonNegativePenalty(
          penalties.checksSkippedWithSourceChanges,
          "changeReport.readiness.penalties.checksSkippedWithSourceChanges",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.checksSkippedWithSourceChanges
        ),
        postWriteReviewPendingOrFailed: assertNonNegativePenalty(
          penalties.postWriteReviewPendingOrFailed,
          "changeReport.readiness.penalties.postWriteReviewPendingOrFailed",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.postWriteReviewPendingOrFailed
        ),
        highRiskFiles: assertNonNegativePenalty(
          penalties.highRiskFiles,
          "changeReport.readiness.penalties.highRiskFiles",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.highRiskFiles
        ),
        mediumRiskFiles: assertNonNegativePenalty(
          penalties.mediumRiskFiles,
          "changeReport.readiness.penalties.mediumRiskFiles",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.mediumRiskFiles
        ),
        scopeDriftWarning: assertNonNegativePenalty(
          penalties.scopeDriftWarning,
          "changeReport.readiness.penalties.scopeDriftWarning",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.scopeDriftWarning
        ),
        nonBlockingReviewerIssue: assertNonNegativePenalty(
          penalties.nonBlockingReviewerIssue,
          "changeReport.readiness.penalties.nonBlockingReviewerIssue",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.nonBlockingReviewerIssue
        )
      }
    }
  };
}
