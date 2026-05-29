import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseReviewerOutput, type ReviewerIssue } from "../reviewer-output.js";
import type { RunMetadata } from "../run-metadata.js";
import type { ChecksStatus, OptionalJsonResult, WriteAuditSummary } from "../reporting/change-report-types.js";
import { createEvidenceManifest, type EvidenceIssueSummary, type EvidenceManifest } from "./evidence-manifest.js";
import { readEvidenceManifestIfExists, writeEvidenceManifest } from "./evidence-store.js";

export interface EvidenceBackfillResult {
  manifest: EvidenceManifest;
  diagnostics: EvidenceBackfillDiagnostics;
}

export interface EvidenceBackfillDiagnostics {
  runJsonMalformed: boolean;
  builderWriteAuditMalformed: boolean;
  fixWriteAuditMalformed: boolean;
  checksMalformed: boolean;
  reviewerMalformed: boolean;
  missingArtefacts: string[];
  malformedArtefacts: string[];
}

export interface BackfillEvidenceFromArtefactsOptions {
  write?: boolean;
}

export async function backfillEvidenceFromRunArtefacts(
  runDir: string,
  options: BackfillEvidenceFromArtefactsOptions = {}
): Promise<EvidenceBackfillResult> {
  await assertRunDirectoryExists(runDir);

  const existing = await readEvidenceManifestIfExists(runDir);
  const runJson = await readOptionalJson<RunMetadata>(path.join(runDir, "run.json"));
  const run = runJson.value;
  const manifest = existing ?? createManifestFromRun(runDir, run);

  const builderSummary = await readOptionalJson<WriteAuditSummary>(path.join(runDir, "write-audit", "builder", "summary.json"));
  const fixSummary = await readOptionalJson<WriteAuditSummary>(path.join(runDir, "write-audit", "fix", "summary.json"));
  const reviewerText = await readOptionalText(path.join(runDir, "reviewer-output-last-message.md"));
  const checks = await readOptionalJson<ChecksStatus>(path.join(runDir, "checks-status.json"));

  const diagnostics: EvidenceBackfillDiagnostics = {
    runJsonMalformed: runJson.malformed,
    builderWriteAuditMalformed: builderSummary.malformed,
    fixWriteAuditMalformed: fixSummary.malformed,
    checksMalformed: checks.malformed,
    reviewerMalformed: false,
    missingArtefacts: [],
    malformedArtefacts: []
  };

  recordJsonArtefactDiagnostic(diagnostics, "run.json", runJson);
  recordJsonArtefactDiagnostic(diagnostics, "write-audit/builder/summary.json", builderSummary);
  recordJsonArtefactDiagnostic(diagnostics, "write-audit/fix/summary.json", fixSummary);
  recordJsonArtefactDiagnostic(diagnostics, "checks-status.json", checks);

  const changedFiles = dedupeSort([
    ...manifest.git.changedFiles,
    ...collectSummaryFiles(builderSummary.value),
    ...collectSummaryFiles(fixSummary.value)
  ]);
  const untrackedFiles = dedupeSort([
    ...manifest.git.untrackedFiles,
    ...collectSummaryUntracked(builderSummary.value),
    ...collectSummaryUntracked(fixSummary.value)
  ]);

  const next: EvidenceManifest = {
    ...manifest,
    projectName: manifest.projectName ?? run?.projectName ?? null,
    stageName: manifest.stageName ?? run?.stageName ?? null,
    workspace: manifest.workspace ?? run?.workspaceRoot ?? null,
    startedAt: manifest.startedAt || run?.startedAt || new Date(0).toISOString(),
    completedAt: manifest.completedAt ?? run?.completedAt ?? undefined,
    status: run?.status && (manifest.status === "in_progress" || manifest.status === "unknown") ? mapRunStatus(run.status) : manifest.status,
    git: {
      ...manifest.git,
      changedFiles,
      untrackedFiles,
      unexpectedFiles: dedupeSort(manifest.git.unexpectedFiles)
    },
    artefacts: dedupeArtefacts([
      ...manifest.artefacts,
      ...collectRunArtefacts(run),
      ...collectKnownArtefacts({
        runJson,
        builderSummary,
        fixSummary,
        checks,
        reviewerAvailable: reviewerText.trim().length > 0
      })
    ])
  };

  if (reviewerText.trim()) {
    try {
      const reviewer = parseReviewerOutput(reviewerText);
      next.reviewer = {
        verdict: reviewer.verdict,
        artefactPath: "reviewer-output-last-message.md",
        blockingIssues: reviewer.blockingIssues.map(mapReviewerIssue),
        nonBlockingIssues: reviewer.nonBlockingIssues.map(mapReviewerIssue),
        ...(reviewer.evidenceChecked
          ? {
              evidenceChecked: reviewer.evidenceChecked.map((item) => ({
                artefact: item.artefact,
                status: item.status,
                ...(item.note ? { note: item.note } : {})
              }))
            }
          : {}),
        ...(reviewer.testsObserved
          ? {
              testsObserved: reviewer.testsObserved.map((item) => ({
                test: item.test,
                outcome: item.outcome,
                ...(item.evidence ? { evidence: item.evidence } : {})
              }))
            }
          : {}),
        ...(reviewer.riskLevel ? { riskLevel: reviewer.riskLevel } : {}),
        ...(reviewer.recommendedFixPrompt ? { recommendedFixPrompt: reviewer.recommendedFixPrompt } : {})
      };
      if (reviewer.acceptanceCriteria && reviewer.acceptanceCriteria.length > 0) {
        next.acceptance = {
          status: reviewer.acceptanceCriteria.every((item) => item.status === "pass")
            ? "pass"
            : reviewer.acceptanceCriteria.some((item) => item.status === "fail")
              ? "fail"
              : "unknown",
          criteria: reviewer.acceptanceCriteria.map((item) => ({
            criterion: item.criterion,
            status: item.status,
            ...(item.evidence ? { evidence: item.evidence } : {})
          }))
        };
      } else {
        delete next.acceptance;
      }
    } catch {
      diagnostics.reviewerMalformed = true;
      diagnostics.malformedArtefacts.push("reviewer-output-last-message.md");
      next.reviewer = {
        verdict: "UNKNOWN",
        artefactPath: "reviewer-output-last-message.md",
        blockingIssues: [],
        nonBlockingIssues: []
      };
      delete next.acceptance;
    }
  } else {
    diagnostics.missingArtefacts.push("reviewer-output-last-message.md");
    delete next.acceptance;
  }

  next.checks = mapChecks(checks.value, checks.malformed);

  const finalManifest = {
    ...next,
    risk: {
      level: next.risk?.level ?? "unknown",
      reasons: dedupeSort([
        ...(next.risk?.reasons ?? []),
        ...diagnostics.malformedArtefacts.map((artefact) => `Malformed evidence artefact: ${artefact}`),
        ...diagnostics.missingArtefacts.map((artefact) => `Missing evidence artefact: ${artefact}`)
      ])
    }
  } satisfies EvidenceManifest;

  diagnostics.missingArtefacts = dedupeSort(diagnostics.missingArtefacts);
  diagnostics.malformedArtefacts = dedupeSort(diagnostics.malformedArtefacts);

  if (options.write ?? true) {
    await writeEvidenceManifest(runDir, finalManifest);
  }

  return { manifest: finalManifest, diagnostics };
}

function createManifestFromRun(runDir: string, run: RunMetadata | null): EvidenceManifest {
  return createEvidenceManifest({
    runId: run?.runId ?? path.basename(path.resolve(runDir)),
    projectName: run?.projectName ?? null,
    stageName: run?.stageName ?? null,
    status: run?.status ? mapRunStatus(run.status) : "unknown",
    workspace: run?.workspaceRoot ?? null,
    startedAt: run?.startedAt ?? new Date(0).toISOString()
  });
}

function mapRunStatus(status: RunMetadata["status"]): EvidenceManifest["status"] {
  if (status === "success") return "pass";
  if (status === "failed") return "fail";
  return "in_progress";
}

function collectSummaryFiles(summary: WriteAuditSummary | null): string[] {
  if (!summary) return [];
  return dedupeSort([...coerceStringArray(summary.post?.changedFiles), ...coerceStringArray(summary.changedFilesAddedByPhase)]);
}

function collectSummaryUntracked(summary: WriteAuditSummary | null): string[] {
  if (!summary) return [];
  return dedupeSort(coerceStringArray(summary.post?.untrackedFiles));
}

function mapReviewerIssue(issue: ReviewerIssue): EvidenceIssueSummary {
  return {
    severity: issue.severity,
    summary: issue.summary,
    files: dedupeSort(issue.files)
  };
}

function mapChecks(checks: ChecksStatus | null, malformed: boolean): EvidenceManifest["checks"] {
  if (malformed) {
    return { status: "unknown", failed: ["Malformed checks-status.json"], skipped: [] };
  }
  const state = typeof checks?.state === "string" ? checks.state : "";
  if (state === "executed") {
    return { status: "passed", failed: [], skipped: [] };
  }
  if (state === "failed") {
    return {
      status: "failed",
      failed: dedupeSort([
        ...coerceStringArray(checks?.failedChecks),
        ...coerceStringArray(checks?.failures),
        ...(typeof checks?.error === "string" && checks.error.trim() ? [checks.error.trim()] : [])
      ]),
      skipped: []
    };
  }
  if (state === "disabled" || state.includes("skipped")) {
    return { status: "skipped", failed: [], skipped: [state || "checks skipped"] };
  }
  return { status: "unknown", failed: [], skipped: [] };
}

function collectRunArtefacts(run: RunMetadata | null): EvidenceManifest["artefacts"] {
  return dedupeArtefacts(
    (run?.artefacts ?? []).map((artefactPath) => ({
      path: artefactPath,
      kind: "run-artefact"
    }))
  );
}

function collectKnownArtefacts(input: {
  runJson: OptionalJsonResult<RunMetadata>;
  builderSummary: OptionalJsonResult<WriteAuditSummary>;
  fixSummary: OptionalJsonResult<WriteAuditSummary>;
  checks: OptionalJsonResult<ChecksStatus>;
  reviewerAvailable: boolean;
}): EvidenceManifest["artefacts"] {
  const artefacts: EvidenceManifest["artefacts"] = [];
  if (input.runJson.value || input.runJson.malformed) artefacts.push({ path: "run.json", kind: "run-metadata" });
  if (input.builderSummary.value || input.builderSummary.malformed) {
    artefacts.push({ path: "write-audit/builder/summary.json", kind: "write-audit", phase: "builder" });
  }
  if (input.fixSummary.value || input.fixSummary.malformed) {
    artefacts.push({ path: "write-audit/fix/summary.json", kind: "write-audit", phase: "fix" });
  }
  if (input.checks.value || input.checks.malformed) artefacts.push({ path: "checks-status.json", kind: "checks" });
  if (input.reviewerAvailable) artefacts.push({ path: "reviewer-output-last-message.md", kind: "reviewer-output", phase: "reviewer" });
  return artefacts;
}

function recordJsonArtefactDiagnostic<T>(
  diagnostics: EvidenceBackfillDiagnostics,
  artefactPath: string,
  result: OptionalJsonResult<T>
): void {
  if (result.malformed) {
    diagnostics.malformedArtefacts.push(artefactPath);
    return;
  }
  if (!result.value) {
    diagnostics.missingArtefacts.push(artefactPath);
  }
}

function dedupeArtefacts(artefacts: EvidenceManifest["artefacts"]): EvidenceManifest["artefacts"] {
  const byPath = new Map<string, EvidenceManifest["artefacts"][number]>();
  for (const artefact of artefacts) {
    const normalizedPath = normalizeRelativePath(artefact.path);
    byPath.set(normalizedPath, { ...artefact, path: normalizedPath });
  }
  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
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
    if (!info.isDirectory()) throw new Error();
  } catch {
    throw new Error(`Run directory not found or unreadable: ${runDir}`);
  }
}

function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
