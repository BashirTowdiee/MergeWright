import type { TuiPhaseStatus, TuiRunStatus } from "../view-models.js";

export type StatusLike = TuiRunStatus | TuiPhaseStatus;

const STATUS_SYMBOLS: Record<StatusLike, string> = {
  pending: "○",
  running: "…",
  passed: "✓",
  failed: "!",
  blocked: "■",
  cancelled: "×",
  skipped: "-",
  unknown: "?"
};

const STATUS_LABELS: Record<StatusLike, string> = {
  pending: "pending",
  running: "running",
  passed: "passed",
  failed: "failed",
  blocked: "blocked",
  cancelled: "cancelled",
  skipped: "skipped",
  unknown: "unknown"
};

const STATUS_LEGEND_ORDER: StatusLike[] = ["passed", "failed", "blocked", "running", "pending", "cancelled", "skipped", "unknown"];

export function getStatusSymbol(status: StatusLike): string {
  return STATUS_SYMBOLS[status] ?? STATUS_SYMBOLS.unknown;
}

export function getStatusLabel(status: StatusLike): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS.unknown;
}

export function getStatusLegendItems(): string[] {
  return STATUS_LEGEND_ORDER.map((status) => `${getStatusSymbol(status)} ${getStatusLabel(status)}`);
}

export function formatStatusLegend(): string {
  return getStatusLegendItems().join("  ");
}
