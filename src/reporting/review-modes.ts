import type { ChangeReport } from "./change-report-types.js";
import type { ReviewerDecision, ReviewerEvidenceCheckStatus, ReviewerIssue, ReviewerRiskLevel, ReviewerTestOutcome } from "../reviewer-output.js";

export type FocusedReviewMode = "architecture" | "tests" | "regression" | "security" | "docs" | "maintainability";

export const DEFAULT_FOCUSED_REVIEW_MODES: FocusedReviewMode[] = [
  "architecture",
  "tests",
  "regression",
  "security",
  "docs",
  "maintainability"
];

export interface FocusedReviewChecklistItem {
  id: string;
  description: string;
  status: "pass" | "fail" | "unknown";
  evidence: string[];
  severity: "low" | "medium" | "high";
}

export interface FocusedModeReview {
  mode: FocusedReviewMode;
  checklist: FocusedReviewChecklistItem[];
  decision: ReviewerDecision;
}

export interface FocusedReviewModesResult {
  version: 1;
  runId: string;
  aggregateVerdict: "PASS" | "FAIL";
  modes: FocusedModeReview[];
  report: ChangeReport;
}

const MISSING_EVIDENCE_PATTERN = /(missing|unavailable|malformed|unknown|unparsable|inconclusive|not found|not observed)/i;
const SECURITY_PATH_PATTERN = /(security|auth|permission|secret|token|credential|crypto|policy|access|acl)/i;
const DOC_PATH_PATTERN = /(^docs\/|\.md$|\.mdx$|readme)/i;
const SOURCE_PATH_PATTERN = /^(src\/|apps\/|packages\/)/i;

export function createFocusedReviewModesResult(input: {
  report: ChangeReport;
  modes: FocusedReviewMode[];
}): FocusedReviewModesResult {
  const modes = dedupeModes(input.modes);
  const modeResults = modes.map((mode) => reviewMode(mode, input.report));
  const aggregateVerdict: "PASS" | "FAIL" = modeResults.some((modeResult) => modeResult.decision.verdict === "FAIL") ? "FAIL" : "PASS";

  return {
    version: 1,
    runId: input.report.runId,
    aggregateVerdict,
    modes: modeResults,
    report: input.report
  };
}

export function parseFocusedReviewModesArg(value: string | undefined): FocusedReviewMode[] {
  if (!value || value.trim().length === 0) {
    return [...DEFAULT_FOCUSED_REVIEW_MODES];
  }
  const tokens = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return [...DEFAULT_FOCUSED_REVIEW_MODES];
  }
  const invalid = tokens.filter((token) => !isFocusedReviewMode(token));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid --modes value: ${invalid.join(", ")}. Allowed modes: ${DEFAULT_FOCUSED_REVIEW_MODES.join(", ")}.`
    );
  }
  return dedupeModes(tokens as FocusedReviewMode[]);
}

function reviewMode(mode: FocusedReviewMode, report: ChangeReport): FocusedModeReview {
  const checklist = buildChecklist(mode, report);
  const decision = buildReviewerDecision(mode, report, checklist);
  return {
    mode,
    checklist,
    decision
  };
}

function buildChecklist(mode: FocusedReviewMode, report: ChangeReport): FocusedReviewChecklistItem[] {
  const hasScopeDrift = report.scopeDriftWarnings.length > 0;
  const checksFailed = report.checks.state === "failed";
  const unresolvedAcceptance = report.acceptanceCriteria.failed > 0 || report.acceptanceCriteria.unknown > 0;
  const missingEvidenceSignals = report.riskSignals.filter((signal) => MISSING_EVIDENCE_PATTERN.test(signal));
  const securityTouched = report.changedFiles.some((file) => SECURITY_PATH_PATTERN.test(file));
  const docsTouched = report.changedFiles.some((file) => DOC_PATH_PATTERN.test(file));
  const sourceTouched = report.changedFiles.some((file) => SOURCE_PATH_PATTERN.test(file));
  const reviewerFailed = report.reviewer.verdict === "FAIL" || report.reviewer.blockingIssues.length > 0;
  const nonBlockingCount = report.reviewer.nonBlockingIssues.length;

  if (mode === "architecture") {
    return [
      item("architecture-scope", "Scope drift warnings are resolved", hasScopeDrift ? "fail" : "pass", report.scopeDriftWarnings, "high"),
      item(
        "architecture-contract",
        "Acceptance criteria mapping is complete",
        unresolvedAcceptance ? "fail" : "pass",
        [`failed=${report.acceptanceCriteria.failed}`, `unknown=${report.acceptanceCriteria.unknown}`],
        "high"
      ),
      item(
        "architecture-boundaries",
        "No reviewer boundary blockers remain",
        reviewerFailed ? "fail" : "pass",
        report.reviewer.blockingIssues.map((issue) => issue.summary),
        "high"
      )
    ];
  }

  if (mode === "tests") {
    return [
      item("tests-checks", "Checks completed successfully", checksFailed ? "fail" : "pass", [...report.checks.failedChecks], "high"),
      item(
        "tests-observed",
        "Reviewer observed test outcomes",
        (report.reviewer.testsObserved?.length ?? 0) === 0 ? "unknown" : "pass",
        report.reviewer.testsObserved?.map((entry) => `${entry.test}:${entry.outcome}`) ?? ["testsObserved missing"],
        "medium"
      ),
      item("tests-evidence", "Missing test evidence signals are absent", missingEvidenceSignals.length > 0 ? "fail" : "pass", missingEvidenceSignals, "medium")
    ];
  }

  if (mode === "regression") {
    return [
      item("regression-readiness", "Readiness status is not blocked by unresolved failures", report.status === "BLOCKED" ? "fail" : "pass", [report.status], "high"),
      item("regression-reviewer", "Reviewer has no blocking regression issues", reviewerFailed ? "fail" : "pass", report.reviewer.blockingIssues.map((issue) => issue.summary), "high"),
      item("regression-checks", "Regression checks are passing", checksFailed ? "fail" : "pass", [...report.checks.failedChecks], "high")
    ];
  }

  if (mode === "security") {
    return [
      item(
        "security-risk",
        "Security-sensitive paths are not high risk",
        securityTouched && report.risk === "high" ? "fail" : "pass",
        securityTouched ? report.changedFiles.filter((file) => SECURITY_PATH_PATTERN.test(file)) : ["no security paths changed"],
        "high"
      ),
      item(
        "security-reviewer",
        "Reviewer verdict is not FAIL for security-sensitive changes",
        securityTouched && reviewerFailed ? "fail" : securityTouched ? "unknown" : "pass",
        report.reviewer.blockingIssues.map((issue) => issue.summary),
        "high"
      ),
      item(
        "security-evidence",
        "Security evidence signals are available",
        missingEvidenceSignals.length > 0 ? "unknown" : "pass",
        missingEvidenceSignals.length > 0 ? missingEvidenceSignals : ["no missing evidence signals"],
        "medium"
      )
    ];
  }

  if (mode === "docs") {
    return [
      item(
        "docs-coverage",
        "Documentation changes are reflected when source changes exist",
        sourceTouched && !docsTouched ? "unknown" : "pass",
        sourceTouched ? report.changedFiles : ["no source changes"],
        "low"
      ),
      item(
        "docs-review",
        "Reviewer docs-related blockers are resolved",
        reviewerFailed && docsTouched ? "fail" : "pass",
        report.reviewer.blockingIssues.map((issue) => issue.summary),
        "medium"
      ),
      item("docs-evidence", "Documentation evidence is available", missingEvidenceSignals.length > 0 ? "unknown" : "pass", missingEvidenceSignals, "low")
    ];
  }

  return [
    item("maintainability-risk", "Overall risk is not high", report.risk === "high" ? "fail" : "pass", [report.risk], "medium"),
    item(
      "maintainability-reviewer",
      "Reviewer issues are manageable",
      reviewerFailed ? "fail" : nonBlockingCount > 3 ? "unknown" : "pass",
      [
        `blocking=${report.reviewer.blockingIssues.length}`,
        `nonBlocking=${nonBlockingCount}`
      ],
      "medium"
    ),
    item(
      "maintainability-size",
      "Changed file count remains reviewable",
      report.changedFiles.length > 40 ? "unknown" : "pass",
      [`changedFiles=${report.changedFiles.length}`],
      "low"
    )
  ];
}

function buildReviewerDecision(mode: FocusedReviewMode, report: ChangeReport, checklist: FocusedReviewChecklistItem[]): ReviewerDecision {
  const blockingIssues: ReviewerIssue[] = checklist
    .filter((item) => item.status === "fail")
    .map((item) => ({
      severity: item.severity === "high" ? "high" : item.severity === "medium" ? "medium" : "low",
      summary: `${mode}: ${item.description}`,
      files: report.changedFiles.slice(0, 10)
    }));

  const nonBlockingIssues: ReviewerIssue[] = checklist
    .filter((item) => item.status === "unknown")
    .map((item) => ({
      severity: "low",
      summary: `${mode}: ${item.description}`,
      files: report.changedFiles.slice(0, 10)
    }));

  const verdict: "PASS" | "FAIL" = blockingIssues.length > 0 ? "FAIL" : "PASS";
  const evidenceChecked = checklist.map((item) => ({
    artefact: `${mode}:${item.id}`,
    status: mapChecklistStatusToEvidence(item.status),
    ...(item.evidence.length > 0 ? { note: item.evidence[0] } : {})
  }));

  const testsObserved =
    mode === "tests" || mode === "regression"
      ? [
          {
            test: "checks-state",
            outcome: mapChecksStateToTestOutcome(report.checks.state),
            evidence: report.checks.failedChecks.join("; ") || report.checks.state
          }
        ]
      : undefined;

  const riskLevel = deriveRiskLevel(report, checklist);
  const recommendedFixPrompt =
    verdict === "FAIL"
      ? `Address ${mode} blocking issues, regenerate report artifacts if needed, and rerun review-modes --modes ${mode}.`
      : undefined;

  return {
    verdict,
    blockingIssues,
    nonBlockingIssues,
    evidenceChecked,
    ...(testsObserved ? { testsObserved } : {}),
    ...(riskLevel ? { riskLevel } : {}),
    ...(recommendedFixPrompt ? { recommendedFixPrompt } : {})
  };
}

function deriveRiskLevel(report: ChangeReport, checklist: FocusedReviewChecklistItem[]): ReviewerRiskLevel {
  if (checklist.some((item) => item.status === "fail" && item.severity === "high")) {
    return "high";
  }
  if (report.risk === "high" || checklist.some((item) => item.status === "fail")) {
    return "high";
  }
  if (report.risk === "medium" || checklist.some((item) => item.status === "unknown")) {
    return "medium";
  }
  return "low";
}

function mapChecksStateToTestOutcome(state: ChangeReport["checks"]["state"]): ReviewerTestOutcome {
  if (state === "passed") return "pass";
  if (state === "failed") return "fail";
  if (state === "skipped") return "not_run";
  return "unknown";
}

function mapChecklistStatusToEvidence(status: FocusedReviewChecklistItem["status"]): ReviewerEvidenceCheckStatus {
  if (status === "pass") return "verified";
  if (status === "fail") return "missing";
  return "inconclusive";
}

function item(
  id: string,
  description: string,
  status: "pass" | "fail" | "unknown",
  evidence: string[],
  severity: "low" | "medium" | "high"
): FocusedReviewChecklistItem {
  return {
    id,
    description,
    status,
    evidence: dedupeSort(evidence),
    severity
  };
}

function dedupeSort(values: string[]): string[] {
  const deduped = Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
  deduped.sort((a, b) => a.localeCompare(b));
  return deduped;
}

function dedupeModes(modes: FocusedReviewMode[]): FocusedReviewMode[] {
  return Array.from(new Set(modes));
}

function isFocusedReviewMode(value: string): value is FocusedReviewMode {
  return (
    value === "architecture" ||
    value === "tests" ||
    value === "regression" ||
    value === "security" ||
    value === "docs" ||
    value === "maintainability"
  );
}
