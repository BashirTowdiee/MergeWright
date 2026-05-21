import { readFile, stat } from "node:fs/promises";
import { readEvidenceManifestIfExists } from "../evidence/evidence-store.js";
import { parseReviewerOutput, type ReviewerIssue } from "../reviewer-output.js";
import type { ChecksStatus, ChangeReport, OptionalJsonResult, RunMetadataWithAutoChain, WriteAuditSummary } from "./change-report-types.js";
import { readEvidenceReportChecks, readEvidenceReportFiles, readEvidenceReportSummary } from "./evidence-report-adapter.js";

export async function collectReportInputs(runDir: string): Promise<{
  run: RunMetadataWithAutoChain | null;
  runJsonMalformed: boolean;
  stageText: string;
  changedFiles: string[];
  untrackedFiles: string[];
  evidence: ChangeReport["evidence"];
  reviewer: {
    verdict: "PASS" | "FAIL" | "unavailable";
    blockingIssues: ReviewerIssue[];
    nonBlockingIssues: ReviewerIssue[];
    available: boolean;
  };
  checks: ChangeReport["checks"] & { malformed: boolean };
  checksMalformed: boolean;
  writeAuditMalformed: boolean;
}> {
  await assertRunDirectoryExists(runDir);

  const runJsonResult = await readOptionalJson<RunMetadataWithAutoChain>(`${runDir}/run.json`);
  const run = runJsonResult.value;
  const stageText = await readOptionalText(`${runDir}/01-stage-input.md`);
  const evidenceManifest = await readEvidenceManifestIfExists(runDir);
  const evidenceFiles = evidenceManifest ? readEvidenceReportFiles(evidenceManifest) : { changedFiles: [], untrackedFiles: [] };

  const builderSummaryResult = await readOptionalJson<WriteAuditSummary>(`${runDir}/write-audit/builder/summary.json`);
  const fixSummaryResult = await readOptionalJson<WriteAuditSummary>(`${runDir}/write-audit/fix/summary.json`);
  const builderSummary = builderSummaryResult.value;
  const fixSummary = fixSummaryResult.value;

  const changedFiles = dedupeSort([...collectSummaryFiles(builderSummary), ...collectSummaryFiles(fixSummary), ...evidenceFiles.changedFiles]);
  const untrackedFiles = dedupeSort([
    ...collectSummaryUntracked(builderSummary),
    ...collectSummaryUntracked(fixSummary),
    ...evidenceFiles.untrackedFiles
  ]);

  const reviewer = await parseReviewer(`${runDir}/reviewer-output-last-message.md`);
  const checksResult = evidenceManifest?.checks
    ? { ...readEvidenceReportChecks(evidenceManifest), malformed: false }
    : await parseChecks(`${runDir}/checks-status.json`);

  return {
    run,
    runJsonMalformed: runJsonResult.malformed,
    stageText,
    changedFiles,
    untrackedFiles,
    evidence: evidenceManifest
      ? readEvidenceReportSummary(evidenceManifest)
      : {
          available: false,
          status: "missing",
          completedAt: null
        },
    reviewer,
    checks: checksResult,
    checksMalformed: checksResult.malformed,
    writeAuditMalformed: builderSummaryResult.malformed || fixSummaryResult.malformed
  };
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

function collectSummaryFiles(summary: WriteAuditSummary | null): string[] {
  if (!summary) return [];
  return dedupeSort([...coerceStringArray(summary.post?.changedFiles), ...coerceStringArray(summary.changedFilesAddedByPhase)]);
}

function collectSummaryUntracked(summary: WriteAuditSummary | null): string[] {
  if (!summary) return [];
  return dedupeSort(coerceStringArray(summary.post?.untrackedFiles));
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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
