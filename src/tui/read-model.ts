import { readFile, stat } from "node:fs/promises";
import path from "node:path";
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
    warnings: details.warnings
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
