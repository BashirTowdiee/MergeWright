export type EvidenceManifestStatus = "in_progress" | "needs_review" | "needs_fix" | "pass" | "fail" | "unknown";
export type EvidenceCommandStatus = "passed" | "failed" | "skipped";

const EVIDENCE_MANIFEST_STATUSES = new Set<EvidenceManifestStatus>([
  "in_progress",
  "needs_review",
  "needs_fix",
  "pass",
  "fail",
  "unknown"
]);

export interface EvidenceCommand {
  id: string;
  label: string;
  command: string;
  cwd: string;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  stdoutPath?: string;
  stderrPath?: string;
  status: EvidenceCommandStatus;
}

export interface EvidenceArtefact {
  path: string;
  kind: string;
  phase?: string;
  description?: string;
}

export interface EvidenceGitState {
  headBefore?: string;
  headAfter?: string;
  statusBefore?: string;
  statusAfter?: string;
  changedFiles: string[];
  untrackedFiles: string[];
  unexpectedFiles: string[];
}

export interface EvidenceReviewSummary {
  verdict?: "PASS" | "FAIL" | "UNKNOWN";
  artefactPath?: string;
  blockingIssues?: EvidenceIssueSummary[];
  nonBlockingIssues?: EvidenceIssueSummary[];
  evidenceChecked?: EvidenceCheckSummary[];
  testsObserved?: EvidenceTestObservation[];
  riskLevel?: "low" | "medium" | "high";
  recommendedFixPrompt?: string;
}

export interface EvidenceIssueSummary {
  summary: string;
  severity?: "low" | "medium" | "high" | "critical";
  files?: string[];
}

export interface EvidenceCheckSummary {
  artefact: string;
  status: "verified" | "missing" | "inconclusive";
  note?: string;
}

export interface EvidenceTestObservation {
  test: string;
  outcome: "pass" | "fail" | "not_run" | "unknown";
  evidence?: string;
}

export interface EvidenceAcceptanceSummary {
  status?: "pass" | "fail" | "unknown";
  criteria: Array<{
    criterion: string;
    status: "pass" | "fail" | "unknown";
    evidence?: string;
  }>;
}

export interface EvidenceRiskSummary {
  level?: "low" | "medium" | "high" | "unknown";
  reasons: string[];
}

export interface EvidenceChecksSummary {
  status?: "passed" | "failed" | "skipped" | "unknown";
  failed: string[];
  skipped: string[];
}

export interface EvidenceWriteSafetySummary {
  status?: "passed" | "failed" | "missing" | "unknown";
  artefactPath?: string;
  warnings: string[];
}

export interface EvidencePostWriteReviewSummary {
  status?: "passed" | "failed" | "missing" | "unknown";
  artefactPath?: string;
}

export interface EvidenceStageContract {
  objective?: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  requiredCommands: string[];
  requiredEvidence: string[];
  acceptanceCriteria: string[];
  reviewChecklist: string[];
}

export interface EvidenceReadinessSummary {
  verdict?: "PASS" | "FAIL" | "UNKNOWN";
  score?: number;
  blockers: string[];
  warnings: string[];
}

export interface EvidenceManifest {
  version: 1;
  runId: string;
  stageId?: string;
  projectName?: string | null;
  stageName?: string | null;
  status: EvidenceManifestStatus;
  workspace: string | null;
  startedAt: string;
  completedAt?: string;
  git: EvidenceGitState;
  commands: EvidenceCommand[];
  artefacts: EvidenceArtefact[];
  reviewer?: EvidenceReviewSummary;
  acceptance?: EvidenceAcceptanceSummary;
  checks?: EvidenceChecksSummary;
  writeSafety?: EvidenceWriteSafetySummary;
  postWriteReview?: EvidencePostWriteReviewSummary;
  stageContract?: EvidenceStageContract;
  readiness?: EvidenceReadinessSummary;
  risk?: EvidenceRiskSummary;
}

export interface CreateEvidenceManifestInput {
  runId: string;
  stageId?: string;
  projectName?: string | null;
  stageName?: string | null;
  status?: EvidenceManifestStatus;
  workspace?: string | null;
  startedAt?: Date | string;
}

export function createEvidenceManifest(input: CreateEvidenceManifestInput): EvidenceManifest {
  const manifest: EvidenceManifest = {
    version: 1,
    runId: input.runId,
    status: input.status ?? "in_progress",
    workspace: input.workspace ?? null,
    startedAt: toIsoString(input.startedAt ?? new Date()),
    git: {
      changedFiles: [],
      untrackedFiles: [],
      unexpectedFiles: []
    },
    commands: [],
    artefacts: []
  };

  if (input.stageId !== undefined) {
    manifest.stageId = input.stageId;
  }
  if (input.projectName !== undefined) {
    manifest.projectName = input.projectName;
  }
  if (input.stageName !== undefined) {
    manifest.stageName = input.stageName;
  }

  return manifest;
}

export function appendEvidenceCommand(manifest: EvidenceManifest, command: EvidenceCommand): EvidenceManifest {
  const commands = manifest.commands.filter((existing) => existing.id !== command.id);
  commands.push(command);
  commands.sort((a, b) => a.id.localeCompare(b.id));
  return {
    ...manifest,
    commands
  };
}

export function appendEvidenceArtefact(manifest: EvidenceManifest, artefact: EvidenceArtefact): EvidenceManifest {
  const normalized = normalizeArtefact(artefact);
  const artefacts = manifest.artefacts.filter((existing) => existing.path !== normalized.path);
  artefacts.push(normalized);
  artefacts.sort((a, b) => a.path.localeCompare(b.path));
  return {
    ...manifest,
    artefacts
  };
}

export function isEvidenceManifest(value: unknown): value is EvidenceManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<EvidenceManifest>;
  const git = candidate.git;

  return (
    candidate.version === 1 &&
    typeof candidate.runId === "string" &&
    isEvidenceManifestStatus(candidate.status) &&
    (candidate.workspace === null || typeof candidate.workspace === "string") &&
    typeof candidate.startedAt === "string" &&
    !!git &&
    typeof git === "object" &&
    Array.isArray(git.changedFiles) &&
    Array.isArray(git.untrackedFiles) &&
    Array.isArray(git.unexpectedFiles) &&
    Array.isArray(candidate.commands) &&
    Array.isArray(candidate.artefacts)
  );
}

function normalizeArtefact(artefact: EvidenceArtefact): EvidenceArtefact {
  return {
    ...artefact,
    path: artefact.path.replace(/\\/g, "/").replace(/^\.\//, "")
  };
}

function isEvidenceManifestStatus(value: unknown): value is EvidenceManifestStatus {
  return typeof value === "string" && EVIDENCE_MANIFEST_STATUSES.has(value as EvidenceManifestStatus);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
