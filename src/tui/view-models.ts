export type TuiRunStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "cancelled" | "unknown";

export type TuiPhaseStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "skipped" | "unknown";

export type TuiRunMode = "dry-run" | "read-only" | "write-enabled" | "auto-chain" | "unknown";

export type TuiArtefactKind = "markdown" | "json" | "log" | "diff" | "text";

export interface RunListItemViewModel {
  id: string;
  title: string;
  status: TuiRunStatus;
  subtitle: string;
  startedAt?: string;
  completedAt?: string;
  branch?: string;
  mode: TuiRunMode;
  warnings: string[];
}

export interface PhaseNodeViewModel {
  id: string;
  label: string;
  status: TuiPhaseStatus;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  artefactIds: string[];
  blockedReason?: string;
}

export interface ArtefactViewModel {
  id: string;
  title: string;
  kind: TuiArtefactKind;
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

export interface SafeActionViewModel {
  id: SafeActionId;
  label: string;
  enabled: boolean;
  blockedReason?: string;
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}

export interface ReviewFindingViewModel {
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  message: string;
  sourceArtefactId?: string;
}

export interface RunDetailViewModel {
  id: string;
  title: string;
  goal?: string;
  status: TuiRunStatus;
  workspaceRoot?: string;
  runDir: string;
  branch?: string;
  mode: TuiRunMode;
  provider?: string;
  model?: string;
  phases: PhaseNodeViewModel[];
  artefacts: ArtefactViewModel[];
  safeActions: SafeActionViewModel[];
  blockedReason?: string;
  reviewerFindings: ReviewFindingViewModel[];
  warnings: string[];
}

export type RenderableArtefact =
  | { kind: "markdown"; title: string; path: string; content: string }
  | { kind: "json"; title: string; path: string; value: unknown; content: string }
  | { kind: "log"; title: string; path: string; lines: string[]; content: string }
  | { kind: "diff"; title: string; path: string; content: string }
  | { kind: "text"; title: string; path: string; content: string };
