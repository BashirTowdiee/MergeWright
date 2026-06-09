import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { RunContract } from "../audited-flow/contract.js";
import type { AuditedFlowResult } from "../use-cases/execute-audited-flow-use-case.js";
import { listRunDirectories, readRunDetails, readRunSummary } from "../../runs.js";
import type { RunDetails, RunSummary as LegacyRunSummary } from "../../runs.js";
import type { RunMetadata } from "../../run-metadata.js";
import type {
  ReviewFinding,
  RunArtefact,
  RunArtefactKind,
  RunDetail,
  RunMode,
  RunPhase,
  RunReadinessSnapshot,
  RunStatus,
  RunSummary,
  SafeAction
} from "../read-models/run-read-model.js";
import type { RunReadRepository } from "./run-query-service.js";

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

interface ChangeReportSnapshot {
  readonly status: string;
  readonly score: number;
  readonly risk: string;
  readonly checks: { readonly state: string };
  readonly reviewer: { readonly verdict: string };
  readonly changedFiles?: readonly string[];
}

export interface FilesystemRunReadRepositoryOptions {
  readonly runsRoot: string;
}

export class FilesystemRunReadRepository implements RunReadRepository {
  private readonly runsRoot: string;

  constructor(options: FilesystemRunReadRepositoryOptions) {
    this.runsRoot = options.runsRoot;
  }

  async listRuns(): Promise<RunSummary[]> {
    const runIds = await listRunDirectories(this.runsRoot);
    const summaries = await Promise.all(runIds.map(async (runId) => this.readRunSummary(runId)));
    return summaries;
  }

  async getRun(runId: string): Promise<RunDetail | null> {
    if (!runId.trim()) {
      return null;
    }

    try {
      const auditedFlow = await readAuditedFlowRun(path.resolve(this.runsRoot, runId));
      if (auditedFlow) {
        return auditedFlow;
      }
      const details = await readRunDetails(this.runsRoot, runId);
      return await mapRunDetail(details);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Run does not exist:")) {
        return null;
      }
      throw error;
    }
  }

  private async readRunSummary(runId: string): Promise<RunSummary> {
    const runDir = path.resolve(this.runsRoot, runId);
    const auditedFlow = await readAuditedFlowRun(runDir);
    if (auditedFlow) {
      return {
        id: auditedFlow.id,
        title: auditedFlow.title,
        status: auditedFlow.status,
        subtitle: `audited flow · ${auditedFlow.mode}`,
        startedAt: undefined,
        completedAt: undefined,
        branch: auditedFlow.branch,
        mode: auditedFlow.mode,
        warnings: [...auditedFlow.warnings]
      };
    }
    return mapRunSummary(await readRunSummary(this.runsRoot, runId));
  }
}

function mapRunSummary(summary: LegacyRunSummary): RunSummary {
  return {
    id: summary.runId,
    title: summary.stageName ?? summary.runId,
    status: mapRunStatus(summary.status, summary.statuses),
    subtitle: `${summary.projectName ?? "unknown project"} · ${summary.preset ?? "manual"}`,
    startedAt: summary.startedAt ?? summary.createdAt.toISOString(),
    completedAt: summary.completedAt ?? undefined,
    mode: mapRunMode(summary.preset),
    warnings: [...summary.warnings]
  };
}

async function mapRunDetail(details: RunDetails): Promise<RunDetail> {
  const metadata = await readOptionalRunMetadata(details.runDir);
  const artefacts = await Promise.all(details.artefacts.map(async (artefactPath) => toRunArtefact(details.runDir, artefactPath)));
  const phases = mapRunPhases(details, artefacts);
  const readiness = await readOptionalReadinessSnapshot(details.runDir);

  return {
    id: details.runId,
    title: details.stageName ?? details.runId,
    goal: details.stageName ?? undefined,
    status: mapRunStatus(details.status, details.statuses),
    workspaceRoot: metadata?.workspaceRoot,
    runDir: details.runDir,
    branch: undefined,
    mode: mapRunMode(details.preset),
    provider: metadata?.phases?.planner?.backend?.backendName,
    model: metadata?.phases?.planner?.backend?.model,
    phases,
    artefacts,
    safeActions: buildSafeActions(details),
    blockedReason: inferBlockedReason(details),
    reviewerFindings: await readReviewerFindings(details, artefacts),
    readiness,
    warnings: [...details.warnings]
  };
}

function mapRunStatus(status: RunDetails["status"], phases: RunDetails["statuses"]): RunStatus {
  if (status === "running") return "running";
  if (status === "success") return "passed";
  if (status === "failed") return "failed";

  if (Object.values(phases).some((phase) => phase === "failed")) {
    return "failed";
  }

  if (Object.values(phases).some((phase) => phase === "executed")) {
    return "blocked";
  }

  return "unknown";
}

function mapRunMode(preset: string | null | undefined): RunMode {
  if (preset === "dry-run") {
    return "dry-run";
  }

  if (preset === "full-readonly" || preset === "plan" || preset === "build" || preset === "review" || preset === "fix-plan") {
    return "read-only";
  }

  if (preset === "auto-chain") {
    return "auto-chain";
  }

  return "unknown";
}

function mapRunPhases(details: RunDetails, artefacts: readonly RunArtefact[]): RunPhase[] {
  return PHASE_ORDER.map((phase) => {
    const status = mapRunPhaseStatus(details.statuses[phase.id]);
    return {
      id: phase.id,
      label: phase.label,
      status,
      summary: status === "failed" ? `${phase.label} failed` : undefined,
      artefactIds: artefacts.filter((artefact) => artefactBelongsToPhase(artefact.path, phase.id)).map((artefact) => artefact.id),
      blockedReason: status === "failed" ? details.errorSummary ?? undefined : undefined
    };
  });
}

function mapRunPhaseStatus(status: RunDetails["statuses"][keyof RunDetails["statuses"]]): RunPhase["status"] {
  if (status === "executed") return "passed";
  if (status === "failed") return "failed";
  if (status === "skipped" || status === "disabled") return "skipped";
  return "unknown";
}

async function toRunArtefact(runDir: string, artefactPath: string): Promise<RunArtefact> {
  const resolved = path.resolve(runDir, artefactPath);
  let sizeBytes: number | undefined;

  try {
    sizeBytes = (await stat(resolved)).size;
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

function inferArtefactKind(artefactPath: string): RunArtefactKind {
  const lower = artefactPath.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".diff") || lower.endsWith(".patch")) return "diff";
  if (lower.endsWith(".log") || lower.includes("stdout") || lower.includes("stderr")) return "log";
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

function artefactBelongsToPhase(artefactPath: string, phaseId: keyof RunDetails["statuses"]): boolean {
  const lower = artefactPath.toLowerCase();
  return PHASE_ARTEFACT_HINTS[phaseId].some((hint) => lower.includes(hint));
}

function buildSafeActions(details: RunDetails): SafeAction[] {
  const runStatus = mapRunStatus(details.status, details.statuses);
  const canContinue = runStatus === "blocked" || runStatus === "failed";
  const canRequestFix = details.statuses.reviewer === "failed" || details.statuses.fixPlanning === "failed";

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
      enabled: runStatus !== "running",
      blockedReason: runStatus === "running" ? "Run is still running." : undefined,
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

function inferBlockedReason(details: RunDetails): string | undefined {
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

async function readReviewerFindings(details: RunDetails, artefacts: readonly RunArtefact[]): Promise<ReviewFinding[]> {
  const reviewerArtefact = artefacts.find((artefact) => artefact.path.includes("reviewer-output-last-message.md"));
  if (!reviewerArtefact) {
    return [];
  }

  try {
    const content = await readFile(path.resolve(details.runDir, reviewerArtefact.path), "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line) || /^(critical|high|medium|low)\b/i.test(line))
      .slice(0, 25)
      .map((line) => ({
        severity: inferSeverity(line),
        message: line.replace(/^[-*]\s+/, ""),
        sourceArtefactId: reviewerArtefact.id
      }));
  } catch {
    return [];
  }
}

function inferSeverity(line: string): ReviewFinding["severity"] {
  const lower = line.toLowerCase();
  if (lower.includes("critical")) return "critical";
  if (lower.includes("high")) return "high";
  if (lower.includes("medium")) return "medium";
  if (lower.includes("low")) return "low";
  return "unknown";
}

async function readOptionalRunMetadata(runDir: string): Promise<RunMetadata | undefined> {
  try {
    const raw = await readFile(path.resolve(runDir, "run.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<RunMetadata>;
    if (parsed && parsed.version === 1 && typeof parsed.workspaceRoot === "string") {
      return parsed as RunMetadata;
    }
  } catch {
    // ignore invalid or missing metadata
  }
  return undefined;
}

async function readOptionalReadinessSnapshot(runDir: string): Promise<RunReadinessSnapshot | undefined> {
  try {
    const raw = await readFile(path.resolve(runDir, "run-report.json"), "utf8");
    const report = JSON.parse(raw) as Partial<ChangeReportSnapshot>;
    if (!report || typeof report.status !== "string") {
      return undefined;
    }

    return {
      source: "report",
      status: mapReadinessStatus(report.status),
      score: typeof report.score === "number" ? report.score : undefined,
      risk: mapRisk(report.risk),
      checksState: mapChecksState(report.checks?.state),
      reviewerVerdict: mapReviewerVerdict(report.reviewer?.verdict),
      changedFileCount: Array.isArray(report.changedFiles) ? report.changedFiles.length : undefined,
      missingEvidenceWarnings: []
    };
  } catch {
    return undefined;
  }
}

async function readAuditedFlowRun(runDir: string): Promise<RunDetail | null> {
  const contract = await readOptionalJson<RunContract>(path.join(runDir, "run-contract.json"));
  const result = await readOptionalJson<AuditedFlowResult>(path.join(runDir, "result.json"));
  if (!contract || !result) {
    return null;
  }

  const failedStage = result.stageResults.find((stage) => stage.status === "failed");
  const blockingStage = result.stageResults.find((stage) => stage.status === "needs-approval");
  const checkStage = result.stageResults.find((stage) => stage.kind === "check");
  const artefactPaths = await collectArtefactPathsSafe(runDir);
  const artefacts = await Promise.all(artefactPaths.map(async (artefactPath) => toRunArtefact(runDir, artefactPath)));
  const phases = result.stageResults.map((stage) => ({
    id: stage.stageId,
    label: stage.stageId,
    status: mapAuditedStageStatus(stage.status),
    summary: stage.summary,
    artefactIds: artefacts
      .filter((artefact) => artifactPathBelongsToAuditedStage(artefact.path, stage.stageId))
      .map((artefact) => artefact.id),
    blockedReason: stage.status === "failed" ? stage.summary : undefined
  })) satisfies RunPhase[];

  return {
    id: result.runId,
    title: contract.goal,
    goal: contract.goal,
    status: mapAuditedRunStatus(result.status),
    workspaceRoot: contract.workspace,
    runDir,
    branch: undefined,
    mode: result.dryRun ? "dry-run" : "read-only",
    provider: result.stageResults[0]?.executor,
    model: contract.stages.find((stage) => typeof stage.model === "string" && stage.model.length > 0)?.model,
    phases,
    artefacts,
    safeActions: [],
    blockedReason:
      result.status === "needs-approval"
        ? blockingStage?.summary ?? "Run is waiting for approval."
        : result.status === "failed"
          ? failedStage?.summary ?? "Audited flow failed."
          : undefined,
    reviewerFindings: [],
    readiness: {
      source: "fallback",
      status: result.status === "passed" ? "READY" : result.status === "needs-approval" ? "NEEDS_REVIEW" : "NEEDS_FIX",
      reviewerVerdict: "unavailable",
      checksState: checkStage ? mapAuditedChecksState(checkStage.status) : "unknown",
      missingEvidenceWarnings: []
    },
    warnings: []
  };
}

function mapAuditedRunStatus(status: AuditedFlowResult["status"]): RunStatus {
  if (status === "passed") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  return "blocked";
}

function mapAuditedStageStatus(status: AuditedFlowResult["stageResults"][number]["status"]): RunPhase["status"] {
  if (status === "passed") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  return "blocked";
}

function mapAuditedChecksState(status: AuditedFlowResult["stageResults"][number]["status"]): RunReadinessSnapshot["checksState"] {
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  if (status === "passed") {
    return "passed";
  }
  return "unknown";
}

function artifactPathBelongsToAuditedStage(artifactPath: string, stageId: string): boolean {
  const prefix = `stages/${stageId.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}/`;
  return artifactPath.toLowerCase().startsWith(prefix);
}

async function collectArtefactPathsSafe(runDir: string): Promise<string[]> {
  try {
    return await collectArtefactPaths(runDir);
  } catch {
    return [];
  }
}

async function collectArtefactPaths(runDir: string): Promise<string[]> {
  const result: string[] = [];
  const queue = [runDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        result.push(path.relative(runDir, fullPath).replace(/\\/g, "/"));
      }
    }
  }

  return result.sort((a, b) => a.localeCompare(b));
}

async function readOptionalJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function mapReadinessStatus(value: string): RunReadinessSnapshot["status"] {
  if (value === "READY" || value === "NEEDS_REVIEW" || value === "NEEDS_FIX" || value === "BLOCKED") {
    return value;
  }
  return "unknown";
}

function mapRisk(value: string | undefined): RunReadinessSnapshot["risk"] {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "unknown";
}

function mapChecksState(value: string | undefined): RunReadinessSnapshot["checksState"] {
  if (value === "passed" || value === "failed" || value === "skipped") {
    return value;
  }
  return "unknown";
}

function mapReviewerVerdict(value: string | undefined): RunReadinessSnapshot["reviewerVerdict"] {
  if (value === "PASS" || value === "FAIL") {
    return value;
  }
  return "UNKNOWN";
}
