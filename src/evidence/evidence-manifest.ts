export type EvidenceManifestStatus = "in_progress" | "needs_review" | "needs_fix" | "pass" | "fail";
export type EvidenceCommandStatus = "passed" | "failed" | "skipped";

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
  unexpectedFiles: string[];
}

export interface EvidenceReviewSummary {
  verdict?: "PASS" | "FAIL" | "UNKNOWN";
  artefactPath?: string;
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

export interface EvidenceManifest {
  version: 1;
  runId: string;
  stageId?: string;
  status: EvidenceManifestStatus;
  workspace: string;
  startedAt: string;
  completedAt?: string;
  git: EvidenceGitState;
  commands: EvidenceCommand[];
  artefacts: EvidenceArtefact[];
  review?: EvidenceReviewSummary;
  acceptance?: EvidenceAcceptanceSummary;
  risk?: EvidenceRiskSummary;
}

export interface CreateEvidenceManifestInput {
  runId: string;
  stageId?: string;
  status?: EvidenceManifestStatus;
  workspace: string;
  startedAt?: Date | string;
}

export function createEvidenceManifest(input: CreateEvidenceManifestInput): EvidenceManifest {
  return {
    version: 1,
    runId: input.runId,
    stageId: input.stageId,
    status: input.status ?? "in_progress",
    workspace: input.workspace,
    startedAt: toIsoString(input.startedAt ?? new Date()),
    git: {
      changedFiles: [],
      unexpectedFiles: []
    },
    commands: [],
    artefacts: []
  };
}

export function appendEvidenceCommand(manifest: EvidenceManifest, command: EvidenceCommand): EvidenceManifest {
  return {
    ...manifest,
    commands: [...manifest.commands.filter((existing) => existing.id !== command.id), command].sort((a, b) => a.id.localeCompare(b.id))
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
  return (
    candidate.version === 1 &&
    typeof candidate.runId === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.workspace === "string" &&
    typeof candidate.startedAt === "string" &&
    !!candidate.git &&
    Array.isArray(candidate.git.changedFiles) &&
    Array.isArray(candidate.git.unexpectedFiles) &&
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

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
