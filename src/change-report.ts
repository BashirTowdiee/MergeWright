import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunMetadata } from "./run-metadata.js";
import { parseReviewerOutput, type ReviewerIssue } from "./reviewer-output.js";

export type CommitReadinessStatus = "READY" | "NEEDS_REVIEW" | "NEEDS_FIX" | "BLOCKED";

export type ChangeRiskLevel = "low" | "medium" | "high";

export interface ChangeReport {
  version: 1;
  runId: string;
  projectName: string | null;
  stageName: string | null;
  status: CommitReadinessStatus;
  score: number;
  risk: ChangeRiskLevel;
  summary: string;
  phases: Record<string, string>;
  changedFiles: string[];
  untrackedFiles: string[];
  reviewer: {
    verdict: "PASS" | "FAIL" | "unavailable";
    blockingIssues: Array<{ severity: string; summary: string; files: string[] }>;
    nonBlockingIssues: Array<{ severity: string; summary: string; files: string[] }>;
  };
  checks: {
    state: "passed" | "failed" | "skipped" | "unknown";
    failedChecks: string[];
  };
  writeSafety: {
    state: string;
  };
  postWriteReview: {
    required: boolean;
    status: string;
  };
  autoChain?: {
    enabled: boolean;
    finalStatus?: string;
    attemptsUsed?: number;
    maxFixAttempts?: number;
  };
  scopeDriftWarnings: string[];
  riskSignals: string[];
  manualReviewChecklist: string[];
  suggestedCommitMessage: string;
}

type RunMetadataWithAutoChain = RunMetadata & {
  autoChain?: {
    enabled?: unknown;
    finalStatus?: unknown;
    attemptsUsed?: unknown;
    maxFixAttempts?: unknown;
  };
};

interface WriteAuditSummary {
  post?: {
    changedFiles?: unknown;
    untrackedFiles?: unknown;
  };
  changedFilesAddedByPhase?: unknown;
}

interface ChecksStatus {
  state?: unknown;
  failedChecks?: unknown;
  failures?: unknown;
  error?: unknown;
}

interface OptionalJsonResult<T> {
  value: T | null;
  malformed: boolean;
}

const HIGH_RISK_PATTERNS = [
  /(^|\/)auth(\/|$)/i,
  /(^|\/)security(\/|$)/i,
  /(^|\/)payment(s)?(\/|$)/i,
  /(^|\/)billing(\/|$)/i,
  /(^|\/)database(\/|$)/i,
  /(^|\/)migration(s)?(\/|$)/i,
  /(^|\/)terraform(\/|$)/i,
  /(^|\/)\.github\/workflows\//i,
  /(^|\/)(package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb|go\.sum|cargo\.lock)$/i,
  /(^|\/)(package\.json|pyproject\.toml|requirements(\.txt)?|poetry\.lock|Pipfile(\.lock)?|Gemfile(\.lock)?|pom\.xml|build\.gradle(\.kts)?|gradle\.properties)$/i,
  /(^|\/)(\.env|\.env\.[^/]+)$/i,
  /(^|\/).*config\.[^/]+$/i
];

const MEDIUM_RISK_PATTERNS = [
  /(^|\/)src\//i,
  /(^|\/)routes?\//i,
  /(^|\/)server\//i,
  /(^|\/)middleware\//i,
  /(^|\/)schema\//i,
  /(^|\/)logger\//i,
  /(^|\/)tests?\//i,
  /\.(test|spec)\.[^/]+$/i
];

const LOGGING_PATTERNS = [/(^|\/)logger\//i, /log(ger|ging)?/i];
const DEPENDENCY_PATTERNS = [/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb)$/i];
const DOCS_ONLY_PATTERNS = [/\.md$/i, /(^|\/)docs\//i, /(^|\/)README(\.[^/]+)?$/i, /(^|\/)CHANGELOG(\.[^/]+)?$/i];
const HIGH_RISK_DOMAIN_HINTS = ["auth", "security", "payment", "billing", "database", "migration", "terraform", "workflow"];

export async function generateChangeReport(input: { runDir: string }): Promise<ChangeReport> {
  const runDir = path.resolve(input.runDir);
  await assertRunDirectoryExists(runDir);

  const runJsonResult = await readOptionalJson<RunMetadataWithAutoChain>(path.resolve(runDir, "run.json"));
  const run = runJsonResult.value;
  const stageText = await readOptionalText(path.resolve(runDir, "01-stage-input.md"));

  const builderSummaryResult = await readOptionalJson<WriteAuditSummary>(path.resolve(runDir, "write-audit/builder/summary.json"));
  const fixSummaryResult = await readOptionalJson<WriteAuditSummary>(path.resolve(runDir, "write-audit/fix/summary.json"));
  const builderSummary = builderSummaryResult.value;
  const fixSummary = fixSummaryResult.value;

  const changedFiles = dedupeSort([
    ...collectSummaryFiles(builderSummary),
    ...collectSummaryFiles(fixSummary)
  ]);
  const untrackedFiles = dedupeSort([
    ...collectSummaryUntracked(builderSummary),
    ...collectSummaryUntracked(fixSummary)
  ]);

  const reviewer = await parseReviewer(path.resolve(runDir, "reviewer-output-last-message.md"));
  const checks = await parseChecks(path.resolve(runDir, "checks-status.json"));

  const writeSafetyState = run?.writeSafety?.state ?? "unknown";
  const postWriteReviewRequired = run?.postWriteReview?.required ?? false;
  const postWriteReviewStatus = run?.postWriteReview?.status ?? "unknown";

  const scopeDriftWarnings = buildScopeDriftWarnings({ stageText, changedFiles, untrackedFiles });
  const riskSignals = buildRiskSignals({
    reviewerVerdict: reviewer.verdict,
    reviewerAvailable: reviewer.available,
    checksState: checks.state,
    checksMalformed: checks.malformed,
    writeSafetyState,
    postWriteReviewStatus,
    untrackedFiles,
    changedFiles,
    runJsonMalformed: runJsonResult.malformed,
    writeAuditMalformed: builderSummaryResult.malformed || fixSummaryResult.malformed
  });

  const risk = classifyRisk({ changedFiles, writeSafetyState, postWriteReviewStatus });
  const status = classifyStatus({
    runStatus: run?.status ?? "unknown",
    reviewerVerdict: reviewer.verdict,
    checksState: checks.state,
    postWriteReviewRequired,
    postWriteReviewStatus,
    autoChainFinalStatus: typeof run?.autoChain?.finalStatus === "string" ? run.autoChain.finalStatus : "",
    risk,
    scopeDriftWarnings
  });
  const score = computeScore({ runStatus: run?.status ?? "unknown", reviewerVerdict: reviewer.verdict, nonBlockingIssueCount: reviewer.nonBlockingIssues.length, checksState: checks.state, hasChangedFiles: changedFiles.length > 0, postWriteReviewRequired, postWriteReviewStatus, risk, scopeDriftWarningCount: scopeDriftWarnings.length });

  const manualReviewChecklist = buildManualReviewChecklist({
    reviewerAvailable: reviewer.available,
    checksState: checks.state,
    risk,
    changedFiles,
    untrackedFiles
  });
  const suggestedCommitMessage = suggestCommitMessage(run?.stageName ?? null);
  const phases = flattenPhases(run);

  const report: ChangeReport = {
    version: 1,
    runId: run?.runId ?? path.basename(runDir),
    projectName: run?.projectName ?? null,
    stageName: run?.stageName ?? null,
    status,
    score,
    risk,
    summary: `${status} (${score}/100) - ${risk} risk`,
    phases,
    changedFiles,
    untrackedFiles,
    reviewer: {
      verdict: reviewer.verdict,
      blockingIssues: reviewer.blockingIssues,
      nonBlockingIssues: reviewer.nonBlockingIssues
    },
    checks,
    writeSafety: { state: writeSafetyState },
    postWriteReview: {
      required: postWriteReviewRequired,
      status: postWriteReviewStatus
    },
    ...(run?.autoChain
      ? {
          autoChain: {
            enabled: Boolean(run.autoChain.enabled),
            finalStatus: readOptionalString(run.autoChain.finalStatus),
            attemptsUsed: readOptionalNumber(run.autoChain.attemptsUsed),
            maxFixAttempts: readOptionalNumber(run.autoChain.maxFixAttempts)
          }
        }
      : {}),
    scopeDriftWarnings,
    riskSignals,
    manualReviewChecklist,
    suggestedCommitMessage
  };

  return report;
}

export function formatChangeReportMarkdown(report: ChangeReport): string {
  const lines: string[] = [
    "# AI Change Report",
    "",
    "## Commit Readiness",
    `- Status: ${report.status}`,
    `- Score: ${report.score}/100`,
    `- Risk: ${report.risk}`,
    "",
    "## Summary",
    report.summary.trim() || "None",
    "",
    "## Run",
    `- Run ID: ${report.runId}`,
    `- Project: ${report.projectName ?? "None"}`,
    `- Stage: ${report.stageName ?? "None"}`,
    "",
    "## Phase Summary",
    `- Planner: ${readPhaseStatus(report, "planner")}`,
    `- Builder: ${readPhaseStatus(report, "builder")}`,
    `- Reviewer: ${readPhaseStatus(report, "reviewer")}`,
    `- Fix planning: ${readPhaseStatus(report, "fixPlanning")}`,
    `- Fix execution: ${readPhaseStatus(report, "fixExecution")}`,
    `- Checks: ${readPhaseStatus(report, "checks")}`,
    "",
    "## Reviewer",
    `- Verdict: ${report.reviewer.verdict}`,
    "- Blocking issues:"
  ];

  lines.push(...renderIssueLines(report.reviewer.blockingIssues));
  lines.push("- Non-blocking issues:");
  lines.push(...renderIssueLines(report.reviewer.nonBlockingIssues));

  lines.push(
    "",
    "## Checks",
    `- State: ${report.checks.state}`,
    "- Failed checks:"
  );
  lines.push(...renderListLines(report.checks.failedChecks));

  lines.push("", "## Changed Files");
  lines.push(...renderListLines(report.changedFiles));
  lines.push("", "## Untracked Files");
  lines.push(...renderListLines(report.untrackedFiles));
  lines.push("", "## Scope Drift");
  lines.push(...renderListLines(report.scopeDriftWarnings));
  lines.push("", "## Risk Signals");
  lines.push(...renderListLines(report.riskSignals));

  lines.push("", "## Auto-chain");
  lines.push(...renderAutoChainLines(report.autoChain));

  lines.push("", "## Manual Review Checklist");
  lines.push(...renderListLines(report.manualReviewChecklist));

  lines.push("", "## Suggested Commit Message", report.suggestedCommitMessage || "None", "");
  return lines.join("\n");
}

export function formatChangeReportJson(report: ChangeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatPrSummaryMarkdown(report: ChangeReport): string {
  const prTitle = report.suggestedCommitMessage.trim() || "Update staged change";
  const summaryText = report.summary.trim();

  const lines: string[] = [
    `# ${prTitle}`,
    "",
    "## Summary",
    summaryText || "None",
    "",
    "## Changes"
  ];

  if (report.changedFiles.length === 0) {
    lines.push("- None");
  } else {
    lines.push(`- Changed files (${dedupeSort(report.changedFiles).length}):`);
    for (const filePath of dedupeSort(report.changedFiles)) {
      lines.push(`- ${filePath}`);
    }
  }

  lines.push("", "## Testing");
  lines.push(`- Checks state: ${report.checks.state}`);
  if (report.checks.state === "failed") {
    lines.push("- Failed checks:");
    lines.push(...renderListLines(report.checks.failedChecks));
  } else if (report.checks.state === "skipped") {
    lines.push("- Failed checks: None (checks skipped)");
  } else if (report.checks.state === "unknown") {
    lines.push("- Failed checks: None (checks status unknown)");
  } else {
    lines.push("- Failed checks: None");
  }
  if (report.status !== "READY") {
    lines.push(`- Commit readiness: ${report.status} (not ready for direct merge)`);
  }

  lines.push("", "## Risk");
  lines.push(`- Risk level: ${report.risk}`);
  lines.push("- Risk signals:");
  lines.push(...renderListLines(report.riskSignals));
  lines.push("- Scope drift warnings:");
  lines.push(...renderListLines(report.scopeDriftWarnings));

  lines.push("", "## Review Notes");
  const blockingIssues = renderIssueLines(report.reviewer.blockingIssues);
  const nonBlockingIssues = renderIssueLines(report.reviewer.nonBlockingIssues);
  lines.push(`- Reviewer verdict: ${report.reviewer.verdict}`);
  lines.push("- Blocking issues:");
  lines.push(...blockingIssues);
  lines.push("- Non-blocking issues:");
  lines.push(...nonBlockingIssues);

  lines.push("", "## Manual Checklist");
  if (report.manualReviewChecklist.length === 0) {
    lines.push("- [ ] None");
  } else {
    for (const item of dedupeSort(report.manualReviewChecklist)) {
      lines.push(`- [ ] ${item}`);
    }
  }

  lines.push("", "## Rollback");
  lines.push("Revert this PR commit set and restore the previous known-good state.");
  lines.push(`Current report status: ${report.status}.`);
  lines.push("");

  return lines.join("\n");
}

export async function writeChangeReport(input: { runDir: string; report: ChangeReport }): Promise<{
  markdownPath: string;
  jsonPath: string;
}> {
  const runDir = path.resolve(input.runDir);
  const markdownPath = resolveWithinRunDir(runDir, "run-report.md");
  const jsonPath = resolveWithinRunDir(runDir, "run-report.json");

  await mkdir(runDir, { recursive: true });
  await writeFile(markdownPath, formatChangeReportMarkdown(input.report), "utf8");
  await writeFile(jsonPath, formatChangeReportJson(input.report), "utf8");

  return { markdownPath, jsonPath };
}

export async function generateAndWriteChangeReport(input: { runDir: string }): Promise<{
  report: ChangeReport;
  markdownPath: string;
  jsonPath: string;
}> {
  const report = await generateChangeReport({ runDir: input.runDir });
  const paths = await writeChangeReport({ runDir: input.runDir, report });
  return { report, ...paths };
}

export async function writePrSummary(input: { runDir: string; report: ChangeReport }): Promise<{ markdownPath: string }> {
  const runDir = path.resolve(input.runDir);
  const markdownPath = resolveWithinRunDir(runDir, "pr-summary.md");

  await mkdir(runDir, { recursive: true });
  await writeFile(markdownPath, formatPrSummaryMarkdown(input.report), "utf8");

  return { markdownPath };
}

export async function generateAndWritePrSummary(input: { runDir: string }): Promise<{
  report: ChangeReport;
  markdownPath: string;
}> {
  const report = await generateChangeReport({ runDir: input.runDir });
  const { markdownPath } = await writePrSummary({ runDir: input.runDir, report });
  return { report, markdownPath };
}

async function parseReviewer(reviewerPath: string): Promise<{
  verdict: "PASS" | "FAIL" | "unavailable";
  blockingIssues: ReviewerIssue[];
  nonBlockingIssues: ReviewerIssue[];
  available: boolean;
}> {
  const raw = await readOptionalText(reviewerPath);
  if (!raw) {
    return { verdict: "unavailable", blockingIssues: [], nonBlockingIssues: [], available: false };
  }
  try {
    const parsed = parseReviewerOutput(raw);
    return {
      verdict: parsed.verdict,
      blockingIssues: parsed.blockingIssues,
      nonBlockingIssues: parsed.nonBlockingIssues,
      available: true
    };
  } catch {
    return { verdict: "unavailable", blockingIssues: [], nonBlockingIssues: [], available: false };
  }
}

async function parseChecks(checksPath: string): Promise<ChangeReport["checks"] & { malformed: boolean }> {
  const checksResult = await readOptionalJson<ChecksStatus>(checksPath);
  const checks = checksResult.value;
  if (!checks || typeof checks.state !== "string") {
    return { state: "unknown", failedChecks: [], malformed: checksResult.malformed };
  }

  const stateText = checks.state;
  if (stateText === "executed") {
    return { state: "passed", failedChecks: [], malformed: checksResult.malformed };
  }
  if (stateText === "failed") {
    const failedChecks = dedupeSort([
      ...coerceStringArray(checks.failedChecks),
      ...coerceStringArray(checks.failures),
      ...(typeof checks.error === "string" && checks.error.trim() ? [checks.error.trim()] : [])
    ]);
    return { state: "failed", failedChecks, malformed: checksResult.malformed };
  }
  if (stateText === "disabled" || stateText.includes("skipped")) {
    return { state: "skipped", failedChecks: [], malformed: checksResult.malformed };
  }
  return { state: "unknown", failedChecks: [], malformed: checksResult.malformed };
}

function classifyStatus(input: {
  runStatus: string;
  reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  checksState: ChangeReport["checks"]["state"];
  postWriteReviewRequired: boolean;
  postWriteReviewStatus: string;
  autoChainFinalStatus: string;
  risk: ChangeRiskLevel;
  scopeDriftWarnings: string[];
}): CommitReadinessStatus {
  if (input.runStatus === "failed") {
    return "BLOCKED";
  }
  if (input.postWriteReviewRequired && (input.postWriteReviewStatus === "pending" || input.postWriteReviewStatus === "failed")) {
    return "BLOCKED";
  }
  if (input.reviewerVerdict === "FAIL") {
    return "NEEDS_FIX";
  }
  if (input.checksState === "failed") {
    return "NEEDS_FIX";
  }
  if (["NEEDS_FIX", "MAX_FIX_ATTEMPTS_REACHED", "CHECKS_FAILED", "FAILED"].includes(input.autoChainFinalStatus)) {
    return "NEEDS_FIX";
  }
  if (
    input.reviewerVerdict === "PASS" &&
    input.checksState === "passed" &&
    input.risk !== "high" &&
    input.scopeDriftWarnings.length === 0 &&
    input.runStatus === "success"
  ) {
    return "READY";
  }
  return "NEEDS_REVIEW";
}

function computeScore(input: {
  runStatus: string;
  reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  nonBlockingIssueCount: number;
  checksState: ChangeReport["checks"]["state"];
  hasChangedFiles: boolean;
  postWriteReviewRequired: boolean;
  postWriteReviewStatus: string;
  risk: ChangeRiskLevel;
  scopeDriftWarningCount: number;
}): number {
  let score = 100;
  if (input.runStatus === "failed") score -= 40;
  if (input.reviewerVerdict === "FAIL") score -= 35;
  if (input.checksState === "failed") score -= 30;
  if ((input.checksState === "unknown" || input.checksState === "skipped") && input.hasChangedFiles) score -= 20;
  if (input.postWriteReviewRequired && (input.postWriteReviewStatus === "pending" || input.postWriteReviewStatus === "failed")) score -= 20;
  if (input.risk === "high") score -= 15;
  if (input.risk === "medium") score -= 10;
  score -= Math.min(30, input.scopeDriftWarningCount * 10);
  score -= Math.min(20, input.nonBlockingIssueCount * 5);
  return clamp(score, 0, 100);
}

function classifyRisk(input: { changedFiles: string[]; writeSafetyState: string; postWriteReviewStatus: string }): ChangeRiskLevel {
  if (input.writeSafetyState === "failed" || input.postWriteReviewStatus === "failed") {
    return "high";
  }
  const files = input.changedFiles;
  if (files.length === 0) {
    return "low";
  }
  if (files.some((file) => matchesAny(file, HIGH_RISK_PATTERNS))) {
    return "high";
  }
  if (isDocsOnly(files)) {
    return "low";
  }
  if (files.some((file) => matchesAny(file, MEDIUM_RISK_PATTERNS))) {
    return "medium";
  }
  return "low";
}

function buildScopeDriftWarnings(input: { stageText: string; changedFiles: string[]; untrackedFiles: string[] }): string[] {
  const warnings: string[] = [];
  const stageLower = input.stageText.toLowerCase();

  if (
    mentionsNoDependencies(input.stageText) &&
    input.changedFiles.some((file) => DEPENDENCY_PATTERNS.some((pattern) => pattern.test(file)))
  ) {
    warnings.push("Dependency files changed even though stage text indicates no dependency changes.");
  }

  const scopedFiles = extractScopeFileList(input.stageText);
  if (scopedFiles.length > 0) {
    const outside = input.changedFiles.filter((changed) =>
      !scopedFiles.some((scoped) => changed === scoped || changed.startsWith(`${scoped}/`))
    );
    if (outside.length > 0) {
      warnings.push("Files changed outside explicit Scope file list in stage text.");
    }
  }

  const touchedHighRisk = input.changedFiles.some((file) => matchesAny(file, HIGH_RISK_PATTERNS));
  const mentionsHighRiskDomain = HIGH_RISK_DOMAIN_HINTS.some((hint) => stageLower.includes(hint));
  if (touchedHighRisk && !mentionsHighRiskDomain) {
    warnings.push("High-risk files changed but stage text does not mention the related domain.");
  }

  if (input.untrackedFiles.length > 0) {
    warnings.push("Untracked files remain after write audit.");
  }

  return dedupeSort(warnings);
}

function buildRiskSignals(input: {
  reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  reviewerAvailable: boolean;
  checksState: ChangeReport["checks"]["state"];
  checksMalformed: boolean;
  writeSafetyState: string;
  postWriteReviewStatus: string;
  untrackedFiles: string[];
  changedFiles: string[];
  runJsonMalformed: boolean;
  writeAuditMalformed: boolean;
}): string[] {
  const signals: string[] = [];
  if (!input.reviewerAvailable) {
    signals.push("Reviewer output unavailable or unparsable.");
  }
  if (input.reviewerVerdict === "FAIL") {
    signals.push("Reviewer verdict is FAIL.");
  }
  if (input.checksState === "failed") {
    signals.push("One or more checks failed.");
  }
  if (input.checksState === "unknown") {
    signals.push("Checks status is unknown.");
  }
  if (input.checksMalformed) {
    signals.push("Checks status artefact is malformed.");
  }
  if (input.runJsonMalformed) {
    signals.push("run.json is malformed.");
  }
  if (input.writeAuditMalformed) {
    signals.push("Write-audit summary artefact is malformed.");
  }
  if (input.writeSafetyState === "failed") {
    signals.push("Write safety check failed.");
  }
  if (input.postWriteReviewStatus === "failed") {
    signals.push("Post-write review failed.");
  }
  if (input.untrackedFiles.length > 0) {
    signals.push("Untracked files detected.");
  }
  if (input.changedFiles.some((file) => matchesAny(file, HIGH_RISK_PATTERNS))) {
    signals.push("High-risk files were changed.");
  }
  return dedupeSort(signals);
}

function buildManualReviewChecklist(input: {
  reviewerAvailable: boolean;
  checksState: ChangeReport["checks"]["state"];
  risk: ChangeRiskLevel;
  changedFiles: string[];
  untrackedFiles: string[];
}): string[] {
  const checklist = ["Inspect git diff.", "Inspect changed files list."];
  if (!input.reviewerAvailable) {
    checklist.push("Inspect reviewer artefacts and verify reviewer output integrity.");
  }
  if (input.checksState !== "passed") {
    checklist.push("Run project checks locally and verify passing status.");
  }
  if (input.risk === "high") {
    checklist.push("Inspect high-risk files carefully for regressions and safety issues.");
  }
  if (input.changedFiles.some((file) => LOGGING_PATTERNS.some((pattern) => pattern.test(file)))) {
    checklist.push("Confirm sensitive values are not logged.");
  }
  if (input.changedFiles.some((file) => DEPENDENCY_PATTERNS.some((pattern) => pattern.test(file)))) {
    checklist.push("Inspect dependency and lockfile changes for unexpected updates.");
  }
  if (input.untrackedFiles.length > 0) {
    checklist.push("Inspect untracked files and decide whether they should be committed or removed.");
  }
  return dedupeSort(checklist);
}

function suggestCommitMessage(stageName: string | null): string {
  if (!stageName) {
    return "Update staged change";
  }
  const cleaned = stageName.replace(/^stage-\d+-?/i, "").replace(/^stage-/, "");
  if (!cleaned) {
    return "Update staged change";
  }
  const text = cleaned
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .join(" ")
    .trim();
  if (!text) {
    return "Update staged change";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function flattenPhases(run: RunMetadataWithAutoChain | null): Record<string, string> {
  const phases: Record<string, string> = {};
  if (!run?.phases || typeof run.phases !== "object") {
    return phases;
  }
  for (const [name, value] of Object.entries(run.phases)) {
    phases[name] = value?.status ?? "unknown";
  }
  return phases;
}

function collectSummaryFiles(summary: WriteAuditSummary | null): string[] {
  if (!summary) return [];
  return dedupeSort([
    ...coerceStringArray(summary.post?.changedFiles),
    ...coerceStringArray(summary.changedFilesAddedByPhase)
  ]);
}

function collectSummaryUntracked(summary: WriteAuditSummary | null): string[] {
  if (!summary) return [];
  return dedupeSort(coerceStringArray(summary.post?.untrackedFiles));
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function mentionsNoDependencies(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes("no dependencies") || lowered.includes("no dependency") || lowered.includes("without dependencies");
}

function extractScopeFileList(stageText: string): string[] {
  const lines = stageText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{1,6}\s*scope\b/i.test(line.trim()));
  if (start === -1) return [];

  const files: string[] = [];
  let inFence = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line.trim())) break;
    if (isFenceStartOrEnd(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/);
    if (!bullet) continue;
    const candidate = bullet[1].replace(/^`|`$/g, "").trim();
    if (candidate && candidate.includes("/")) {
      files.push(candidate);
    } else if (candidate && /\.[a-z0-9]+$/i.test(candidate)) {
      files.push(candidate);
    }
  }
  return dedupeSort(files);
}

function isDocsOnly(files: string[]): boolean {
  return files.length > 0 && files.every((file) => matchesAny(file, DOCS_ONLY_PATTERNS));
}

function matchesAny(file: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(file));
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function readOptionalText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readOptionalJson<T>(filePath: string): Promise<OptionalJsonResult<T>> {
  const raw = await readOptionalText(filePath);
  if (!raw.trim()) {
    return { value: null, malformed: false };
  }
  try {
    return { value: JSON.parse(raw) as T, malformed: false };
  } catch {
    return { value: null, malformed: true };
  }
}

function isFenceStartOrEnd(line: string): boolean {
  return /^\s*```/.test(line);
}

async function assertRunDirectoryExists(runDir: string): Promise<void> {
  try {
    const info = await stat(runDir);
    if (!info.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(`Run directory not found or unreadable: ${runDir}`);
  }
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function renderListLines(items: string[]): string[] {
  const sorted = dedupeSort(items);
  return sorted.length > 0 ? sorted.map((item) => `- ${item}`) : ["- None"];
}

function renderIssueLines(issues: Array<{ severity: string; summary: string; files: string[] }>): string[] {
  if (issues.length === 0) {
    return ["- None"];
  }
  const sorted = [...issues].sort((a, b) => {
    const aKey = `${a.severity}\u0000${a.summary}\u0000${dedupeSort(a.files).join(",")}`;
    const bKey = `${b.severity}\u0000${b.summary}\u0000${dedupeSort(b.files).join(",")}`;
    return aKey.localeCompare(bKey);
  });
  return sorted.map((issue) => {
    const files = dedupeSort(issue.files);
    const suffix = files.length > 0 ? ` (files: ${files.join(", ")})` : "";
    return `- [${issue.severity}] ${issue.summary}${suffix}`;
  });
}

function renderAutoChainLines(
  autoChain: ChangeReport["autoChain"]
): string[] {
  if (!autoChain) {
    return ["- None"];
  }
  return [
    `- Enabled: ${autoChain.enabled}`,
    `- Final status: ${autoChain.finalStatus ?? "None"}`,
    `- Attempts used: ${autoChain.attemptsUsed ?? "None"}`,
    `- Max fix attempts: ${autoChain.maxFixAttempts ?? "None"}`
  ];
}

function readPhaseStatus(report: ChangeReport, phaseName: string): string {
  return report.phases[phaseName] ?? "unknown";
}

function resolveWithinRunDir(runDir: string, filename: string): string {
  const resolved = path.resolve(runDir, filename);
  const relative = path.relative(runDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside run directory: ${runDir}`);
  }
  return resolved;
}
