import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ChangeReport } from "../change-report.js";
import { isEvidenceManifest } from "../evidence/evidence-manifest.js";
import { listRunDirectories, readRunDetails, readRunSummary, resolveRunDir } from "../runs.js";
import type { RunDetails, RunSummary } from "../runs.js";
import type { RunPhaseStatus, RunStatus } from "../run-metadata.js";
import type {
  ArtefactViewModel,
  PhaseNodeViewModel,
  RenderableArtefact,
  ReviewFindingViewModel,
  RunDetailViewModel,
  RunListItemViewModel,
  SafeActionViewModel,
  TuiArtefactKind,
  TuiPhaseStatus,
  TuiRunMode,
  TuiRunStatus
} from "./view-models.js";

const PHASE_ORDER: Array<{ id: keyof RunDetails["statuses"]; label: string }> = [
  { id: "planner", label: "Planner" },
  { id: "builder", label: "Builder" },
  { id: "reviewer", label: "Reviewer" },
  { id: "fixPlanning", label: "Fix Planner" },
  { id: "fixExecution", label: "Fix Executor" },
  { id: "checks", label: "Checks" }
];

const PHASE_ARTEFACT_HINTS: Record<keyof RunDetails["statuses"], string[]> = {
  planner: ["planner"],
  builder: ["builder"],
  reviewer: ["reviewer"],
  fixPlanning: ["review-to-fix"],
  fixExecution: ["fix"],
  checks: ["check"]
};

export async function listRunsForTui(input: { runsRoot: string; filter?: TuiRunStatus | "all" }): Promise<RunListItemViewModel[]> {
  const runIds = await listRunDirectories(input.runsRoot);
  const runs = await Promise.all(runIds.map((runId) => readRunSummary(input.runsRoot, runId).then(mapRunSummaryToListItem)));
  const filter = input.filter ?? "all";
  if (filter === "all") {
    return runs;
  }
  return runs.filter((run) => run.status === filter);
}

export async function inspectRunForTui(input: { runsRoot: string; runId: string }): Promise<RunDetailViewModel> {
  const details = await readRunDetails(input.runsRoot, input.runId);
  const artefacts = await Promise.all(details.artefacts.map((artefactPath) => toArtefactViewModel(details.runDir, artefactPath)));
  const phases = mapPhases(details, artefacts);
  const reviewerFindings = await extractReviewerFindings(details, artefacts);
  const readiness = await readRunReadinessSnapshot(details.runDir);
  return {
    id: details.runId,
    title: details.stageName ?? details.runId,
    goal: details.stageName ?? undefined,
    status: mapRunStatus(details.status, details.statuses),
    runDir: details.runDir,
    workspaceRoot: undefined,
    mode: mapRunMode(details.preset),
    phases,
    artefacts,
    safeActions: getAvailableActionsForRunDetails(details),
    blockedReason: getBlockedReason(details),
    reviewerFindings,
    readiness,
    warnings: mergeWarnings(details.warnings, readiness.missingEvidenceWarnings.map((warning) => `evidence: ${warning}`))
  };
}

export async function readArtefactForTui(input: { runsRoot: string; runId: string; artefactId: string }): Promise<RenderableArtefact> {
  const runDir = resolveRunDir(input.runsRoot, input.runId);
  const artefactPath = assertSafeArtefactPath(runDir, input.artefactId);
  const content = await readFile(artefactPath, "utf8");
  const title = path.basename(input.artefactId);
  const kind = inferArtefactKind(input.artefactId);

  if (kind === "json") {
    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch {
      value = null;
    }
    return { kind, title, path: input.artefactId, value, content };
  }

  if (kind === "log") {
    return { kind, title, path: input.artefactId, lines: content.split(/\r?\n/), content };
  }

  return { kind, title, path: input.artefactId, content };
}

export async function getAvailableActionsForTui(input: { runsRoot: string; runId: string }): Promise<SafeActionViewModel[]> {
  const details = await readRunDetails(input.runsRoot, input.runId);
  return getAvailableActionsForRunDetails(details);
}

function mapRunSummaryToListItem(summary: RunSummary): RunListItemViewModel {
  return {
    id: summary.runId,
    title: summary.stageName ?? summary.runId,
    status: mapRunStatus(summary.status, summary.statuses),
    subtitle: `${summary.projectName ?? "unknown project"} · ${summary.preset ?? "manual"}`,
    startedAt: summary.startedAt ?? summary.createdAt.toISOString(),
    completedAt: summary.completedAt ?? undefined,
    mode: mapRunMode(summary.preset),
    warnings: summary.warnings
  };
}

function mapRunStatus(status: RunStatus | "unknown", phases: RunDetails["statuses"]): TuiRunStatus {
  if (status === "running") {
    return "running";
  }
  if (status === "success") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (Object.values(phases).some((phase) => phase === "failed")) {
    return "failed";
  }
  if (Object.values(phases).some((phase) => phase === "executed")) {
    return "blocked";
  }
  return "unknown";
}

function mapPhaseStatus(status: RunPhaseStatus): TuiPhaseStatus {
  switch (status) {
    case "executed":
      return "passed";
    case "failed":
      return "failed";
    case "skipped":
    case "disabled":
      return "skipped";
    case "unknown":
    default:
      return "unknown";
  }
}

function mapRunMode(preset: string | null | undefined): TuiRunMode {
  if (preset === "plan" || preset === "build" || preset === "review" || preset === "fix-plan" || preset === "full-readonly") {
    return "read-only";
  }
  if (preset === "dry-run") {
    return "dry-run";
  }
  return "unknown";
}

function mapPhases(details: RunDetails, artefacts: ArtefactViewModel[]): PhaseNodeViewModel[] {
  return PHASE_ORDER.map((phase) => {
    const status = mapPhaseStatus(details.statuses[phase.id]);
    const artefactIds = artefacts
      .filter((artefact) => artefactBelongsToPhase(artefact.path, phase.id))
      .map((artefact) => artefact.id);
    return {
      id: phase.id,
      label: phase.label,
      status,
      summary: status === "failed" ? `${phase.label} failed` : undefined,
      artefactIds,
      blockedReason: status === "failed" ? details.errorSummary ?? undefined : undefined
    };
  });
}

function artefactBelongsToPhase(artefactPath: string, phase: keyof RunDetails["statuses"]): boolean {
  const lower = artefactPath.toLowerCase();
  return PHASE_ARTEFACT_HINTS[phase].some((hint) => lower.includes(hint));
}

async function toArtefactViewModel(runDir: string, artefactPath: string): Promise<ArtefactViewModel> {
  const fullPath = assertSafeArtefactPath(runDir, artefactPath);
  let sizeBytes: number | undefined;
  try {
    sizeBytes = (await stat(fullPath)).size;
  } catch {
    sizeBytes = undefined;
  }
  return {
    id: artefactPath,
    title: path.basename(artefactPath),
    kind: inferArtefactKind(artefactPath),
    path: artefactPath,
    phaseId: inferPhaseId(artefactPath),
    sizeBytes
  };
}

function inferArtefactKind(artefactPath: string): TuiArtefactKind {
  const lower = artefactPath.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "markdown";
  }
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (lower.endsWith(".log") || lower.includes("stdout") || lower.includes("stderr")) {
    return "log";
  }
  if (lower.endsWith(".diff") || lower.endsWith(".patch")) {
    return "diff";
  }
  return "text";
}

function inferPhaseId(artefactPath: string): string | undefined {
  const lower = artefactPath.toLowerCase();
  for (const phase of PHASE_ORDER) {
    if (PHASE_ARTEFACT_HINTS[phase.id].some((hint) => lower.includes(hint))) {
      return phase.id;
    }
  }
  return undefined;
}

function getAvailableActionsForRunDetails(details: RunDetails): SafeActionViewModel[] {
  const status = mapRunStatus(details.status, details.statuses);
  const canRequestFix = details.statuses.reviewer === "failed" || details.statuses.fixPlanning === "failed";
  const canContinue = status === "blocked" || status === "failed";
  return [
    {
      id: "open-run-folder",
      label: "Open run folder",
      enabled: true,
      risk: "low",
      requiresConfirmation: false
    },
    {
      id: "generate-report",
      label: "Generate change report",
      enabled: status !== "running",
      blockedReason: status === "running" ? "Run is still running." : undefined,
      risk: "low",
      requiresConfirmation: false
    },
    {
      id: "request-fix",
      label: "Request fix",
      enabled: canRequestFix,
      blockedReason: canRequestFix ? undefined : "Reviewer or fix planning must fail before a fix can be requested.",
      risk: "medium",
      requiresConfirmation: false
    },
    {
      id: "continue",
      label: "Continue run",
      enabled: canContinue,
      blockedReason: canContinue ? undefined : "Run is not in a continuable state.",
      risk: "medium",
      requiresConfirmation: false
    }
  ];
}

function getBlockedReason(details: RunDetails): string | undefined {
  if (details.errorSummary) {
    return details.errorSummary;
  }
  if (details.statuses.reviewer === "failed") {
    return "Reviewer failed. Request a fix or inspect reviewer output.";
  }
  if (details.statuses.checks === "failed") {
    return "Checks failed. Inspect checks output before continuing.";
  }
  return undefined;
}

async function extractReviewerFindings(details: RunDetails, artefacts: ArtefactViewModel[]): Promise<ReviewFindingViewModel[]> {
  const reviewer = artefacts.find((artefact) => artefact.path.includes("reviewer-output-last-message.md"));
  if (!reviewer) {
    return [];
  }
  try {
    const content = await readFile(assertSafeArtefactPath(details.runDir, reviewer.path), "utf8");
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line) || /^(critical|high|medium|low)\b/i.test(line))
      .slice(0, 20);
    return lines.map((line) => ({ severity: inferSeverity(line), message: line.replace(/^[-*]\s+/, ""), sourceArtefactId: reviewer.id }));
  } catch {
    return [];
  }
}

function inferSeverity(line: string): ReviewFindingViewModel["severity"] {
  const lower = line.toLowerCase();
  if (lower.includes("critical")) return "critical";
  if (lower.includes("high")) return "high";
  if (lower.includes("medium")) return "medium";
  if (lower.includes("low")) return "low";
  return "unknown";
}

type TuiReadinessSnapshot = NonNullable<RunDetailViewModel["readiness"]>;

const MISSING_EVIDENCE_PATTERN = /(missing|unavailable|malformed|unknown|unparsable|inconclusive|not found|not observed)/i;

async function readRunReadinessSnapshot(runDir: string): Promise<TuiReadinessSnapshot> {
  const reportSnapshot = await readReportReadinessSnapshot(runDir);
  if (reportSnapshot) {
    return reportSnapshot;
  }

  const evidenceSnapshot = await readEvidenceReadinessSnapshot(runDir);
  if (evidenceSnapshot) {
    return evidenceSnapshot;
  }

  return {
    source: "fallback",
    status: "unknown",
    reviewerVerdict: "UNKNOWN",
    checksState: "unknown",
    missingEvidenceWarnings: [
      "run-report.json not found; generate a change report for readiness details.",
      "evidence.json not found; readiness evidence manifest is unavailable."
    ]
  };
}

async function readReportReadinessSnapshot(runDir: string): Promise<TuiReadinessSnapshot | null> {
  const parsed = await readOptionalJson(path.join(runDir, "run-report.json"));
  if (!isRunReportLike(parsed)) {
    return null;
  }

  return {
    source: "report",
    status: parsed.status,
    score: parsed.score,
    risk: parsed.risk,
    reviewerVerdict: parsed.reviewer.verdict,
    checksState: parsed.checks.state,
    changedFileCount: parsed.changedFiles.length,
    missingEvidenceWarnings: collectReportEvidenceWarnings(parsed)
  };
}

async function readEvidenceReadinessSnapshot(runDir: string): Promise<TuiReadinessSnapshot | null> {
  const parsed = await readOptionalJson(path.join(runDir, "evidence.json"));
  if (!isEvidenceManifest(parsed)) {
    return null;
  }

  const warnings = [...(parsed.readiness?.warnings ?? [])];
  if (!parsed.reviewer) {
    warnings.push("Reviewer evidence summary is missing from evidence manifest.");
  }
  if (!parsed.checks) {
    warnings.push("Checks evidence summary is missing from evidence manifest.");
  }

  return {
    source: "evidence",
    status: mapEvidenceStatus(parsed.status, parsed.readiness?.verdict),
    score: typeof parsed.readiness?.score === "number" ? parsed.readiness.score : undefined,
    risk: normalizeRisk(parsed.risk?.level),
    reviewerVerdict: parsed.reviewer?.verdict ?? "UNKNOWN",
    checksState: normalizeChecksState(parsed.checks?.status),
    changedFileCount: parsed.git.changedFiles.length,
    missingEvidenceWarnings: dedupeStrings(warnings)
  };
}

function collectReportEvidenceWarnings(report: RunReportLike): string[] {
  const warnings: string[] = [];
  if (report.evidence?.available === false) {
    warnings.push("Evidence manifest unavailable; report was collected from fallback artefacts.");
  }
  for (const signal of report.riskSignals) {
    if (MISSING_EVIDENCE_PATTERN.test(signal)) {
      warnings.push(signal);
    }
  }
  return dedupeStrings(warnings);
}

function mapEvidenceStatus(
  status: "in_progress" | "needs_review" | "needs_fix" | "pass" | "fail" | "unknown",
  verdict?: "PASS" | "FAIL" | "UNKNOWN"
): TuiReadinessSnapshot["status"] {
  if (verdict === "PASS") return "READY";
  if (verdict === "FAIL") return "NEEDS_FIX";
  if (status === "pass") return "READY";
  if (status === "fail" || status === "needs_fix") return "NEEDS_FIX";
  if (status === "in_progress" || status === "needs_review") return "NEEDS_REVIEW";
  return "unknown";
}

function normalizeRisk(level: string | undefined): TuiReadinessSnapshot["risk"] {
  if (level === "low" || level === "medium" || level === "high" || level === "unknown") {
    return level;
  }
  return undefined;
}

function normalizeChecksState(state: string | undefined): TuiReadinessSnapshot["checksState"] {
  if (state === "passed" || state === "failed" || state === "skipped" || state === "unknown") {
    return state;
  }
  return "unknown";
}

function mergeWarnings(base: string[], additions: string[]): string[] {
  return dedupeStrings([...base, ...additions]);
}

function dedupeStrings(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

async function readOptionalJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

type RunReportLike = Pick<ChangeReport, "status" | "score" | "risk" | "changedFiles" | "checks" | "reviewer" | "riskSignals" | "evidence">;

function isRunReportLike(value: unknown): value is RunReportLike {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RunReportLike>;
  const status = candidate.status;
  const score = candidate.score;
  const risk = candidate.risk;
  const checks = candidate.checks;
  const reviewer = candidate.reviewer;
  return (
    (status === "READY" || status === "NEEDS_REVIEW" || status === "NEEDS_FIX" || status === "BLOCKED") &&
    typeof score === "number" &&
    (risk === "low" || risk === "medium" || risk === "high") &&
    Array.isArray(candidate.changedFiles) &&
    Array.isArray(candidate.riskSignals) &&
    !!checks &&
    (checks.state === "passed" || checks.state === "failed" || checks.state === "skipped" || checks.state === "unknown") &&
    !!reviewer &&
    (reviewer.verdict === "PASS" || reviewer.verdict === "FAIL" || reviewer.verdict === "unavailable")
  );
}

function assertSafeArtefactPath(runDir: string, artefactPath: string): string {
  if (!artefactPath || path.isAbsolute(artefactPath)) {
    throw new Error(`Invalid artefact path: ${artefactPath}`);
  }
  const resolved = path.resolve(runDir, artefactPath);
  const relative = path.relative(runDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Invalid artefact path: ${artefactPath}`);
  }
  return resolved;
}
