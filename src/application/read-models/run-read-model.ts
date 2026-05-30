export type RunStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "cancelled" | "unknown";

export type RunPhaseStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "skipped" | "unknown";

export type RunMode = "dry-run" | "read-only" | "write-enabled" | "auto-chain" | "unknown";

export type RunArtefactKind = "markdown" | "json" | "log" | "diff" | "text";

export interface RunSummary {
  id: string;
  title: string;
  status: RunStatus;
  subtitle: string;
  startedAt?: string;
  completedAt?: string;
  branch?: string;
  mode: RunMode;
  warnings: string[];
}

export interface RunPhase {
  id: string;
  label: string;
  status: RunPhaseStatus;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  artefactIds: string[];
  blockedReason?: string;
}

export interface RunArtefact {
  id: string;
  title: string;
  kind: RunArtefactKind;
  path: string;
  phaseId?: string;
  sizeBytes?: number;
}

export type SafeActionId =
  | "continue"
  | "request-fix"
  | "generate-report"
  | "generate-pr-summary"
  | "open-artefact"
  | "open-run-folder"
  | "rerun-reviewer"
  | "stop";

export interface SafeAction {
  id: SafeActionId;
  label: string;
  enabled: boolean;
  blockedReason?: string;
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}

export interface ReviewFinding {
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  message: string;
  sourceArtefactId?: string;
}

export type RunReadinessStatus = "READY" | "NEEDS_REVIEW" | "NEEDS_FIX" | "BLOCKED" | "unknown";

export interface RunReadinessSnapshot {
  source: "report" | "evidence" | "fallback";
  status: RunReadinessStatus;
  score?: number;
  risk?: "low" | "medium" | "high" | "unknown";
  checksState?: "passed" | "failed" | "skipped" | "unknown";
  reviewerVerdict?: "PASS" | "FAIL" | "unavailable" | "UNKNOWN";
  changedFileCount?: number;
  missingEvidenceWarnings: string[];
}

export interface RunDetail {
  id: string;
  title: string;
  goal?: string;
  status: RunStatus;
  workspaceRoot?: string;
  runDir: string;
  branch?: string;
  mode: RunMode;
  provider?: string;
  model?: string;
  phases: RunPhase[];
  artefacts: RunArtefact[];
  safeActions: SafeAction[];
  blockedReason?: string;
  reviewerFindings: ReviewFinding[];
  readiness?: RunReadinessSnapshot;
  warnings: string[];
}

export type RenderableArtefact =
  | { kind: "markdown"; title: string; path: string; content: string }
  | { kind: "json"; title: string; path: string; value: unknown; content: string }
  | { kind: "log"; title: string; path: string; lines: string[]; content: string }
  | { kind: "diff"; title: string; path: string; content: string }
  | { kind: "text"; title: string; path: string; content: string };
