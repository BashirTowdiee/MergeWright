import type { RunDetail, RunPhase, RunSummary } from "../application/read-models/run-read-model.js";

export interface RunListItemViewModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status: RunSummary["status"];
  readonly branchLabel: string;
  readonly modeLabel: string;
  readonly warningCount: number;
}

export interface RunPhaseViewModel {
  readonly id: string;
  readonly label: string;
  readonly status: RunPhase["status"];
  readonly summary: string;
  readonly artifactCount: number;
  readonly durationLabel: string;
  readonly blockedReason?: string;
}

export interface RunDetailViewModel {
  readonly id: string;
  readonly title: string;
  readonly status: RunDetail["status"];
  readonly branchLabel: string;
  readonly modeLabel: string;
  readonly phaseCount: number;
  readonly artifactCount: number;
  readonly reviewerFindingCount: number;
  readonly safeActionCount: number;
  readonly blockedReason?: string;
  readonly phases: readonly RunPhaseViewModel[];
}

export function toRunListItemViewModel(run: RunSummary): RunListItemViewModel {
  return {
    id: run.id,
    title: run.title,
    subtitle: run.subtitle,
    status: run.status,
    branchLabel: run.branch ?? "No branch",
    modeLabel: formatMode(run.mode),
    warningCount: run.warnings.length
  };
}

export function toRunDetailViewModel(run: RunDetail): RunDetailViewModel {
  return {
    id: run.id,
    title: run.title,
    status: run.status,
    branchLabel: run.branch ?? "No branch",
    modeLabel: formatMode(run.mode),
    phaseCount: run.phases.length,
    artifactCount: run.artefacts.length,
    reviewerFindingCount: run.reviewerFindings.length,
    safeActionCount: run.safeActions.filter((action) => action.enabled).length,
    blockedReason: run.blockedReason,
    phases: run.phases.map(toRunPhaseViewModel)
  };
}

function toRunPhaseViewModel(phase: RunPhase): RunPhaseViewModel {
  return {
    id: phase.id,
    label: phase.label,
    status: phase.status,
    summary: phase.summary ?? "No summary available",
    artifactCount: phase.artefactIds.length,
    durationLabel: formatDuration(phase.durationMs),
    blockedReason: phase.blockedReason
  };
}

function formatMode(mode: RunSummary["mode"]): string {
  return mode
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) {
    return "Not recorded";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}
