import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer, type CliCommandEvent } from "../src/api/create-api-server.js";
import type { CliCommandGateway, CliCommandExecutionResult, CliGatewayRequest } from "../src/api/cli-command-gateway.js";
import type { RunContract } from "../src/application/audited-flow/contract.js";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import type { AppCommandExecutionOptions, AppCommandService } from "../src/application/commands/app-command-service.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import type { AuditedFlowAuditQueryService } from "../src/application/queries/audited-flow-audit-query-service.js";
import type { PolicySnapshot, WriteSafetyStatusSnapshot } from "../src/application/read-models/policy-read-model.js";
import type { ProjectDetail, ProjectHealth, ProjectSummary } from "../src/application/read-models/project-read-model.js";
import type { ProviderInventory } from "../src/application/read-models/provider-read-model.js";
import type { AuditedFlowAuditEventView } from "../src/application/read-models/audited-flow-read-model.js";
import type { ReviewItemView } from "../src/application/read-models/review-read-model.js";
import type { RunEvidenceView, RunReadinessView, RunReviewView } from "../src/application/read-models/run-insights-read-model.js";
import type { RunPhaseArtifactsView } from "../src/application/read-models/run-phase-artifacts-read-model.js";
import type { RunDetail, RunSummary, RunArtefact, RunArtefactContent } from "../src/application/read-models/run-read-model.js";
import type { SettingsSnapshot, SettingsUpdate } from "../src/application/read-models/settings-read-model.js";
import type { StagePlanDetail, StagePlanSummary } from "../src/application/read-models/stage-plan-read-model.js";
import type { AuditedFlowResult } from "../src/application/use-cases/execute-audited-flow-use-case.js";
import type { ArtifactQueryService, GetArtifactContentInput, GetArtifactInput, ListArtifactsInput } from "../src/application/queries/artifact-query-service.js";
import type { PolicyQueryService } from "../src/application/queries/policy-query-service.js";
import type { ProjectQueryService } from "../src/application/queries/project-query-service.js";
import type { ProviderQueryService } from "../src/application/queries/provider-query-service.js";
import type { ReviewQueryService } from "../src/application/queries/review-query-service.js";
import type { RunComparisonQueryService } from "../src/application/queries/run-comparison-query-service.js";
import type { RunInsightsQueryService } from "../src/application/queries/run-insights-query-service.js";
import type { RunQueryService, ListRunsInput, GetRunInput } from "../src/application/queries/run-query-service.js";
import type { SettingsQueryService } from "../src/application/queries/settings-query-service.js";
import type { StagePlanQueryService } from "../src/application/queries/stage-plan-query-service.js";
import type { RunComparisonView } from "../src/application/read-models/run-comparison-read-model.js";

const runSummary: RunSummary = {
  id: "run-1",
  title: "Run one",
  status: "running",
  subtitle: "In progress",
  startedAt: "2026-05-25T00:00:00.000Z",
  branch: "feature/demo",
  mode: "read-only",
  warnings: []
};

const completedRunSummary: RunSummary = {
  id: "run-2",
  title: "Run two",
  status: "passed",
  subtitle: "Complete",
  completedAt: "2026-05-25T01:00:00.000Z",
  mode: "dry-run",
  warnings: ["No artefacts"]
};

const planArtifact: RunArtefact = {
  id: "plan",
  title: "Plan",
  kind: "markdown",
  path: "plan.md",
  phaseId: "planner"
};

const reviewArtifact: RunArtefact = {
  id: "review",
  title: "Review",
  kind: "json",
  path: "review.json",
  phaseId: "reviewer",
  sizeBytes: 128
};

const runDetail: RunDetail = {
  id: "run-1",
  title: "Run one",
  goal: "Validate API route wiring",
  status: "running",
  workspaceRoot: "/tmp/workspace",
  runDir: "/tmp/workspace/.mergewright/run-1",
  branch: "feature/demo",
  mode: "read-only",
  provider: "codex",
  model: "gpt",
  phases: [
    {
      id: "planner",
      label: "Planner",
      status: "passed",
      artefactIds: ["plan"]
    }
  ],
  artefacts: [planArtifact, reviewArtifact],
  safeActions: [
    {
      id: "continue",
      label: "Continue",
      enabled: true,
      risk: "low",
      requiresConfirmation: false
    }
  ],
  reviewerFindings: [],
  warnings: []
};

const stagePlanSummary: StagePlanSummary = {
  id: "c3RhZ2UtcGxhbnMvZGVtby9zdGFnZS1wbGFuLmpzb24",
  planId: "provider-switching",
  title: "Provider switching",
  goal: "Migrate providers safely",
  source: "imported",
  status: "running",
  updatedAt: "2026-05-31T02:00:00.000Z",
  stageCount: 3,
  path: "stage-plans/demo/stage-plan.json"
};

const stagePlanDetail: StagePlanDetail = {
  id: stagePlanSummary.id,
  planId: "provider-switching",
  title: "Provider switching",
  goal: "Migrate providers safely",
  source: "imported",
  status: "running",
  createdAt: "2026-05-31T01:00:00.000Z",
  updatedAt: "2026-05-31T02:00:00.000Z",
  path: "stage-plans/demo/stage-plan.json",
  stageCount: 3,
  statusCounts: {
    pending: 1,
    running: 1,
    reviewRequired: 1,
    accepted: 0,
    fixRequired: 0,
    failed: 0,
    committed: 0
  },
  stages: [
    {
      id: "stage-01-provider-contract",
      index: 0,
      title: "Provider contract",
      status: "running",
      dependsOn: [],
      revision: 1,
      acceptanceCriteriaCount: 3,
      checksCount: 2
    }
  ]
};

const projectSummary: ProjectSummary = {
  id: "default",
  name: "MergeWright",
  configPath: "/tmp/config.json",
  workspaceRoot: "/tmp/workspace",
  runsRoot: "/tmp/runs",
  defaultProvider: "codex-local"
};

const projectDetail: ProjectDetail = {
  ...projectSummary,
  orchestratorRoot: "/tmp/orchestrator",
  stagesRoot: "/tmp/orchestrator/stages",
  promptsRoot: "/tmp/orchestrator/prompts",
  providers: ["codex-local", "opencode-local"]
};

const projectHealth: ProjectHealth = {
  projectId: "default",
  healthy: true,
  checks: {
    configPathExists: true,
    workspaceRootExists: true,
    runsRootExists: true,
    stagesRootExists: true,
    promptsRootExists: true
  },
  warnings: []
};

const providerInventory: ProviderInventory = {
  defaultProvider: "codex-local",
  providers: [
    {
      id: "codex-local",
      type: "codex-cli",
      command: "codex",
      usedByRoles: ["planner", "builder", "reviewer"],
      supportsReadOnly: true,
      supportsWrites: true,
      supportsProbe: false
    },
    {
      id: "opencode-local",
      type: "opencode-cli",
      command: "opencode",
      usedByRoles: [],
      supportsReadOnly: true,
      supportsWrites: true,
      supportsProbe: true
    }
  ]
};

const policySnapshot: PolicySnapshot = {
  requireGitRepo: true,
  requireCleanStart: true,
  manualCommitOnly: true,
  forbidAutoCommit: true,
  forbidAutoPush: true,
  writeSafetyEnabled: true,
  requireCleanWorkingTree: true,
  requireExplicitAllowWrites: true,
  requireReviewAfterWrites: true,
  allowedBranches: ["main", "feature/*"],
  blockedPaths: ["package-lock.json"],
  checkCount: 3
};

const writeSafetyStatus: WriteSafetyStatusSnapshot = {
  checkedAt: "2026-05-31T00:00:00.000Z",
  ok: true,
  summary: "Write safety checks passed.",
  failures: [],
  warnings: [],
  enabled: true,
  branch: "feature/demo",
  isGitWorkTree: true,
  workingTreeState: "clean",
  changedFilesCount: 0,
  blockedMatchCount: 0
};

const settingsSnapshot: SettingsSnapshot = {
  version: 1,
  project: {
    activeProjectId: "default",
    defaultConfigPath: "/tmp/config.json",
    runsRoot: "/tmp/runs",
    defaultProvider: "codex-local",
    defaultModel: "gpt-5.5",
    defaultMode: "preview-first"
  },
  retention: {
    evidenceDays: 30,
    artifactDays: 30
  },
  ui: {
    theme: "system",
    keyboardShortcuts: true
  },
  updatedAt: "2026-05-31T00:00:00.000Z"
};

const runReadinessView: RunReadinessView = {
  runId: "run-1",
  ready: false,
  status: "NEEDS_FIX",
  score: 64,
  risk: "high",
  checksState: "failed",
  reviewerVerdict: "FAIL",
  missingEvidenceWarnings: ["Acceptance evidence missing."],
  blockedReason: "Needs confirmation",
  nextAction: "request-fix"
};

const runReviewView: RunReviewView = {
  runId: "run-1",
  verdict: "FAIL",
  blockingFindings: [
    {
      severity: "high",
      message: "Missing acceptance evidence"
    }
  ],
  nonBlockingFindings: [
    {
      severity: "low",
      message: "Consider extracting helper"
    }
  ],
  recommendedFixPrompt: "Fix acceptance mapping and rerun checks.",
  testsObservedCount: 2,
  acceptanceCriteriaCount: 3
};

const runEvidenceView: RunEvidenceView = {
  runId: "run-1",
  available: true,
  status: "needs_fix",
  blockerCount: 2,
  warningCount: 1,
  items: [
    {
      id: "manifest",
      label: "Evidence manifest",
      status: "pass",
      blocking: true,
      note: "status=needs_fix",
      sourcePath: "evidence.json"
    },
    {
      id: "checks",
      label: "Checks evidence",
      status: "fail",
      blocking: true,
      note: "status=failed"
    }
  ]
};

const runPhaseArtifactsView: RunPhaseArtifactsView = {
  runId: "run-1",
  phases: [
    {
      id: "planner",
      label: "Planner",
      status: "passed",
      artifacts: [planArtifact]
    },
    {
      id: "reviewer",
      label: "Reviewer",
      status: "failed",
      artifacts: [reviewArtifact]
    }
  ],
  unassignedArtifacts: []
};

const reviewItem: ReviewItemView = {
  id: "run-1",
  runId: "run-1",
  title: "Run one",
  status: "pending",
  readinessStatus: "NEEDS_FIX",
  reviewerVerdict: "FAIL",
  checksState: "failed",
  blockerCount: 1,
  blockers: ["Missing acceptance evidence"],
  commentCount: 1,
  updatedAt: "2026-05-31T02:30:00.000Z",
  comments: [
    {
      id: "comment-1",
      author: "operator",
      message: "Please confirm blocker scope.",
      createdAt: "2026-05-31T02:20:00.000Z"
    }
  ],
  decision: {
    decision: "changes_requested",
    author: "reviewer",
    note: "Needs fix before approval",
    decidedAt: "2026-05-31T02:30:00.000Z"
  }
};

const runComparisonView: RunComparisonView = {
  version: 1,
  runA: {
    runId: "run-1",
    status: "NEEDS_FIX",
    score: 64,
    risk: "high",
    reviewerVerdict: "FAIL",
    checksState: "failed",
    changedFileCount: 5,
    acceptanceCriteria: { expected: 3, passed: 1, failed: 2, unknown: 0 },
    missingEvidenceWarnings: ["Acceptance evidence missing."]
  },
  runB: {
    runId: "run-2",
    status: "READY",
    score: 92,
    risk: "low",
    reviewerVerdict: "PASS",
    checksState: "passed",
    changedFileCount: 4,
    acceptanceCriteria: { expected: 3, passed: 3, failed: 0, unknown: 0 },
    missingEvidenceWarnings: []
  },
  deltas: {
    score: 28,
    risk: "lower",
    readinessChanged: true,
    checksChanged: true,
    reviewerChanged: true,
    changedFileCount: -1
  },
  changedFiles: {
    onlyInA: ["src/a.ts"],
    onlyInB: ["src/b.ts"],
    inBothCount: 2
  },
  checks: {
    failedOnlyInA: ["npm test"],
    failedOnlyInB: []
  },
  acceptance: {
    regressions: [],
    improvements: ["criteria-a: fail -> pass"]
  }
};

const auditedFlowEvents: AuditedFlowAuditEventView[] = [
  {
    type: "run.created",
    runId: "run-1",
    occurredAt: "2026-06-09T00:00:00.000Z",
    payload: {
      flow: "feature-standard"
    }
  },
  {
    type: "command.completed",
    runId: "run-1",
    occurredAt: "2026-06-09T00:00:02.000Z",
    stageId: "checks",
    executorId: "shell-check",
    payload: {
      name: "unit",
      exitCode: 0,
      success: true
    }
  }
];

const auditedFlowResult: AuditedFlowResult = {
  runId: "audited-run-1",
  status: "passed",
  dryRun: true,
  auditPath: "/tmp/runs/audited-run-1/audit.ndjson",
  artefactsDir: "/tmp/runs/audited-run-1",
  stageResults: [
    {
      stageId: "plan",
      kind: "plan",
      executor: "deterministic-dry-run",
      status: "passed",
      summary: "Dry-run plan completed."
    }
  ]
};

class FakeRunQueryService implements RunQueryService {
  readonly listCalls: ListRunsInput[] = [];
  readonly getCalls: GetRunInput[] = [];

  constructor(private readonly runs: RunSummary[] = [runSummary, completedRunSummary]) {}

  async listRuns(input: ListRunsInput = {}): Promise<RunSummary[]> {
    this.listCalls.push(input);
    if (input.status === undefined || input.status === "all") {
      return this.runs;
    }
    return this.runs.filter((run) => run.status === input.status);
  }

  async getRun(input: GetRunInput): Promise<RunDetail | null> {
    this.getCalls.push(input);
    if (input.runId === runDetail.id) {
      return runDetail;
    }
    return null;
  }
}

class FakeArtifactQueryService implements ArtifactQueryService {
  readonly listCalls: ListArtifactsInput[] = [];
  readonly getCalls: GetArtifactInput[] = [];
  readonly contentCalls: GetArtifactContentInput[] = [];

  constructor(private readonly artifacts: RunArtefact[] = [planArtifact, reviewArtifact]) {}

  async listArtifacts(input: ListArtifactsInput): Promise<RunArtefact[]> {
    this.listCalls.push(input);
    if (input.runId !== runDetail.id) {
      return [];
    }
    if (!input.phaseId) {
      return this.artifacts;
    }
    return this.artifacts.filter((artifact) => artifact.phaseId === input.phaseId);
  }

  async listPhaseArtifacts(input: { runId: string }): Promise<RunPhaseArtifactsView | null> {
    if (input.runId !== runDetail.id) {
      return null;
    }
    return runPhaseArtifactsView;
  }

  async getArtifact(input: GetArtifactInput): Promise<RunArtefact | null> {
    this.getCalls.push(input);
    if (input.runId !== runDetail.id) {
      return null;
    }
    return this.artifacts.find((artifact) => artifact.id === input.artifactId) ?? null;
  }

  async getArtifactContent(input: GetArtifactContentInput): Promise<RunArtefactContent | null> {
    this.contentCalls.push(input);
    if (input.runId !== runDetail.id) {
      return null;
    }
    const artifact = this.artifacts.find((candidate) => candidate.id === input.artifactId);
    if (!artifact) {
      return null;
    }
    return {
      artifact,
      content: `content:${artifact.path}`,
      truncated: false,
      maxBytes: input.maxBytes ?? 256000
    };
  }
}

class FakeCommandService implements AppCommandService {
  readonly executeCalls: Array<{ command: AppCommand; options: AppCommandExecutionOptions }> = [];

  async describe(command: AppCommand): Promise<CommandDescription> {
    return {
      commandId: command.commandId,
      type: command.type,
      title: "Fake command",
      summary: "Fake command summary",
      risk: "low",
      requiresConfirmation: false,
      preconditions: [],
      effects: []
    };
  }

  async execute(command: AppCommand, options: AppCommandExecutionOptions = {}): Promise<AppCommandResult> {
    this.executeCalls.push({ command, options });
    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: "Command accepted"
    };
  }
}

class FakeStagePlanQueryService implements StagePlanQueryService {
  readonly listCalls: number[] = [];
  readonly getCalls: string[] = [];

  async listStagePlans(): Promise<StagePlanSummary[]> {
    this.listCalls.push(1);
    return [stagePlanSummary];
  }

  async getStagePlan(stagePlanId: string): Promise<StagePlanDetail | null> {
    this.getCalls.push(stagePlanId);
    if (stagePlanId === stagePlanSummary.id) {
      return stagePlanDetail;
    }
    return null;
  }
}

class FakeAuditedFlowAuditQueryService implements AuditedFlowAuditQueryService {
  readonly listCalls: Array<{ runId: string }> = [];

  async listEvents(input: { runId: string }): Promise<AuditedFlowAuditEventView[]> {
    this.listCalls.push(input);
    return input.runId === runDetail.id ? auditedFlowEvents : [];
  }
}

class FakeProjectQueryService implements ProjectQueryService {
  readonly listCalls: number[] = [];
  readonly getCalls: string[] = [];
  readonly healthCalls: string[] = [];
  readonly createCalls: Array<{ name: string; configPath: string }> = [];
  readonly updateCalls: Array<{ projectId: string; name?: string; configPath?: string }> = [];
  readonly updateConfigCalls: Array<{ projectId: string; runsDir?: string; defaultProvider?: string; defaultModel?: string }> = [];
  readonly deleteCalls: string[] = [];

  async listProjects(): Promise<ProjectSummary[]> {
    this.listCalls.push(1);
    return [projectSummary];
  }

  async getProject(projectId: string): Promise<ProjectDetail | null> {
    this.getCalls.push(projectId);
    if (projectId === projectSummary.id) {
      return projectDetail;
    }
    return null;
  }

  async getProjectHealth(projectId: string): Promise<ProjectHealth | null> {
    this.healthCalls.push(projectId);
    if (projectId === projectSummary.id) {
      return projectHealth;
    }
    return null;
  }

  async createProject(input: { name: string; configPath: string }): Promise<ProjectDetail> {
    this.createCalls.push(input);
    return { ...projectDetail, id: "new-project", name: input.name, configPath: input.configPath };
  }

  async updateProject(projectId: string, input: { name?: string; configPath?: string }): Promise<ProjectDetail | null> {
    this.updateCalls.push({ projectId, ...input });
    if (projectId !== projectSummary.id) {
      return null;
    }
    return {
      ...projectDetail,
      name: input.name ?? projectDetail.name,
      configPath: input.configPath ?? projectDetail.configPath
    };
  }

  async deleteProject(projectId: string): Promise<{ ok: true } | { ok: false; code: "PROJECT_NOT_EMPTY"; reason: string } | null> {
    this.deleteCalls.push(projectId);
    if (projectId === "blocked") {
      return { ok: false, code: "PROJECT_NOT_EMPTY", reason: "Project has data." };
    }
    if (projectId !== projectSummary.id) {
      return null;
    }
    return { ok: true };
  }

  async updateProjectConfig(
    projectId: string,
    input: { runsDir?: string; defaultProvider?: string; defaultModel?: string }
  ): Promise<ProjectDetail | null> {
    this.updateConfigCalls.push({ projectId, ...input });
    if (projectId !== projectSummary.id) {
      return null;
    }
    return {
      ...projectDetail,
      runsRoot: input.runsDir ?? projectDetail.runsRoot,
      defaultProvider: input.defaultProvider ?? projectDetail.defaultProvider
    };
  }

  async resolveProjectContext(_projectId: string): Promise<null> {
    return null;
  }
}

class FakeProviderQueryService implements ProviderQueryService {
  readonly calls: number[] = [];

  async getProviderInventory(): Promise<ProviderInventory> {
    this.calls.push(1);
    return providerInventory;
  }
}

class FakePolicyQueryService implements PolicyQueryService {
  readonly policyCalls: number[] = [];
  readonly writeSafetyCalls: number[] = [];

  async getPolicySnapshot(): Promise<PolicySnapshot> {
    this.policyCalls.push(1);
    return policySnapshot;
  }

  async getWriteSafetyStatus(): Promise<WriteSafetyStatusSnapshot> {
    this.writeSafetyCalls.push(1);
    return writeSafetyStatus;
  }
}

class FakeSettingsQueryService implements SettingsQueryService {
  readonly getCalls: number[] = [];
  readonly updateCalls: SettingsUpdate[] = [];
  private current: SettingsSnapshot = settingsSnapshot;

  async getSettings(): Promise<SettingsSnapshot> {
    this.getCalls.push(1);
    return this.current;
  }

  async updateSettings(input: SettingsUpdate): Promise<SettingsSnapshot> {
    this.updateCalls.push(input);
    this.current = {
      ...this.current,
      project: {
        ...this.current.project,
        ...(input.project ?? {})
      },
      retention: {
        ...this.current.retention,
        ...(input.retention ?? {})
      },
      ui: {
        ...this.current.ui,
        ...(input.ui ?? {})
      },
      updatedAt: "2026-05-31T00:05:00.000Z"
    };
    return this.current;
  }
}

class FakeRunInsightsQueryService implements RunInsightsQueryService {
  readonly readinessCalls: string[] = [];
  readonly reviewCalls: string[] = [];
  readonly evidenceCalls: string[] = [];

  async getRunReadiness(runId: string): Promise<RunReadinessView | null> {
    this.readinessCalls.push(runId);
    if (runId !== runDetail.id) {
      return null;
    }
    return runReadinessView;
  }

  async getRunReview(runId: string): Promise<RunReviewView | null> {
    this.reviewCalls.push(runId);
    if (runId !== runDetail.id) {
      return null;
    }
    return runReviewView;
  }

  async getRunEvidence(runId: string): Promise<RunEvidenceView | null> {
    this.evidenceCalls.push(runId);
    if (runId !== runDetail.id) {
      return null;
    }
    return runEvidenceView;
  }
}

class FakeRunComparisonQueryService implements RunComparisonQueryService {
  readonly compareCalls: Array<{ runIdA: string; runIdB: string }> = [];

  async compareRuns(input: { runIdA: string; runIdB: string }): Promise<RunComparisonView | null> {
    this.compareCalls.push(input);
    if (input.runIdA === "run-1" && input.runIdB === "run-2") {
      return runComparisonView;
    }
    return null;
  }
}

class FakeReviewQueryService implements ReviewQueryService {
  readonly listCalls: number[] = [];
  readonly commentCalls: Array<{ reviewId: string; author?: string; message: string }> = [];
  readonly decisionCalls: Array<{ reviewId: string; decision: "approved" | "changes_requested"; author?: string; note?: string }> = [];

  async listReviews(): Promise<ReviewItemView[]> {
    this.listCalls.push(1);
    return [reviewItem];
  }

  async addComment(reviewId: string, input: { author?: string; message: string }): Promise<ReviewItemView | null> {
    this.commentCalls.push({ reviewId, ...input });
    if (reviewId !== reviewItem.id) {
      return null;
    }
    return {
      ...reviewItem,
      comments: [...reviewItem.comments, { id: "comment-2", author: input.author ?? "operator", message: input.message, createdAt: "2026-05-31T03:00:00.000Z" }],
      commentCount: reviewItem.commentCount + 1
    };
  }

  async decideReview(
    reviewId: string,
    input: { decision: "approved" | "changes_requested"; author?: string; note?: string }
  ): Promise<ReviewItemView | null> {
    this.decisionCalls.push({ reviewId, ...input });
    if (reviewId !== reviewItem.id) {
      return null;
    }
    return {
      ...reviewItem,
      status: input.decision === "approved" ? "approved" : "changes_requested",
      decision: {
        decision: input.decision,
        author: input.author ?? "operator",
        note: input.note,
        decidedAt: "2026-05-31T03:01:00.000Z"
      }
    };
  }
}

class FakeCliCommandGateway implements CliCommandGateway {
  readonly executeCalls: CliGatewayRequest[] = [];
  readonly previewCalls: CliGatewayRequest[] = [];

  async preview(input: CliGatewayRequest) {
    this.previewCalls.push(input);
    return {
      requestId: input.requestId,
      command: input.command.command,
      equivalentCli: "npm run mergewright -- continue-run run-1 --config config.example.json",
      risk: "medium" as const,
      requiresConfirmation: true,
      summaryLines: ["Command: continue-run", "Risk: medium"],
      effects: {
        mayWriteWorkspace: false,
        mayWriteArtifacts: true,
        mayChangeGit: false
      }
    };
  }

  async execute(input: CliGatewayRequest): Promise<CliCommandExecutionResult> {
    this.executeCalls.push(input);
    return {
      requestId: input.requestId,
      command: input.command.command,
      ok: input.command.command !== "prove",
      exitCode: input.command.command === "prove" ? 1 : 0,
      summaryLines: ["Gateway executed"],
      data: { command: input.command.command },
      error: input.command.command === "prove" ? "prove failed: BLOCKED" : undefined
    };
  }
}

function createSelectTaskCommand(overrides: Partial<AppCommand> = {}): AppCommand {
  return {
    commandId: "cmd-1",
    source: "automation",
    requestedAt: "2026-05-25T00:00:00.000Z",
    type: "select-task",
    taskId: "task-1",
    ...overrides
  } as AppCommand;
}

test("GET /health returns API status", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "mergewright-api" });
});

test("GET /projects lists projects through the query service", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), projectQueryService });
  const response = await server.inject({ method: "GET", url: "/projects" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { projects: [projectSummary] });
  assert.equal(projectQueryService.listCalls.length, 1);
});

test("POST /projects/init scaffolds and registers project", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const initCalls: Array<{ name: string; workspacePath: string; force: boolean }> = [];
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    projectQueryService,
    initProject: async (input) => {
      initCalls.push(input);
      return { configPath: "/tmp/generated-config.json" };
    }
  });
  const response = await server.inject({
    method: "POST",
    url: "/projects/init",
    payload: {
      project: {
        name: "New Project",
        workspacePath: "/tmp/workspace"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(initCalls, [{ name: "New Project", workspacePath: "/tmp/workspace", force: false }]);
  assert.deepEqual(projectQueryService.createCalls, [{ name: "New Project", configPath: "/tmp/generated-config.json" }]);
});

test("POST /projects/init returns 503 when init is not configured", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    projectQueryService
  });
  const response = await server.inject({
    method: "POST",
    url: "/projects/init",
    payload: {
      project: {
        name: "New Project",
        workspacePath: "/tmp/workspace"
      }
    }
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
    message: "Project init is not configured."
  });
});

test("POST /system/select-workspace returns selected path", async () => {
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    selectWorkspacePath: async () => "/tmp/workspace-selected"
  });
  const response = await server.inject({
    method: "POST",
    url: "/system/select-workspace"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { workspacePath: "/tmp/workspace-selected" });
});

test("POST /system/select-workspace returns 503 when picker is unavailable", async () => {
  const server = createApiServer({
    runQueryService: new FakeRunQueryService()
  });
  const response = await server.inject({
    method: "POST",
    url: "/system/select-workspace"
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "WORKSPACE_PICKER_UNAVAILABLE",
    message: "Workspace picker is not configured."
  });
});

test("POST /system/select-workspace returns 409 when picker is cancelled", async () => {
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    selectWorkspacePath: async () => null
  });
  const response = await server.inject({
    method: "POST",
    url: "/system/select-workspace"
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    code: "WORKSPACE_PICKER_CANCELLED",
    message: "Workspace selection was cancelled."
  });
});

test("GET /projects/:projectId returns project detail", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), projectQueryService });
  const response = await server.inject({ method: "GET", url: "/projects/default" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { project: projectDetail });
  assert.deepEqual(projectQueryService.getCalls, ["default"]);
});

test("GET /projects/:projectId/health returns project health", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), projectQueryService });
  const response = await server.inject({ method: "GET", url: "/projects/default/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { health: projectHealth });
  assert.deepEqual(projectQueryService.healthCalls, ["default"]);
});

test("PUT /projects/:projectId/config updates project config", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), projectQueryService });
  const response = await server.inject({
    method: "PUT",
    url: "/projects/default/config",
    payload: {
      config: {
        runsDir: ".artifacts/runs/default",
        defaultProvider: "opencode-local",
        defaultModel: "gpt-5.5"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(projectQueryService.updateConfigCalls.length, 1);
  assert.deepEqual(projectQueryService.updateConfigCalls[0], {
    projectId: "default",
    runsDir: ".artifacts/runs/default",
    defaultProvider: "opencode-local",
    defaultModel: "gpt-5.5"
  });
});

test("PUT /projects/:projectId/config validates request payload", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), projectQueryService });
  const response = await server.inject({
    method: "PUT",
    url: "/projects/default/config",
    payload: {
      config: {}
    }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid project config update request."
  });
});

test("GET /projects/:projectId returns 404 for missing project", async () => {
  const projectQueryService = new FakeProjectQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), projectQueryService });
  const response = await server.inject({ method: "GET", url: "/projects/missing" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "PROJECT_NOT_FOUND",
    message: "Project not found."
  });
});

test("GET /projects returns 503 when project query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/projects" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
    message: "Project query service is not configured."
  });
});

test("GET /providers returns provider inventory", async () => {
  const providerQueryService = new FakeProviderQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), providerQueryService });
  const response = await server.inject({ method: "GET", url: "/providers" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { inventory: providerInventory });
  assert.equal(providerQueryService.calls.length, 1);
});

test("GET /providers returns 503 when provider query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/providers" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "PROVIDER_QUERY_SERVICE_UNAVAILABLE",
    message: "Provider query service is not configured."
  });
});

test("GET /policy returns policy snapshot", async () => {
  const policyQueryService = new FakePolicyQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), policyQueryService });
  const response = await server.inject({ method: "GET", url: "/policy" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { policy: policySnapshot });
  assert.equal(policyQueryService.policyCalls.length, 1);
});

test("GET /safety/write-status returns write safety status snapshot", async () => {
  const policyQueryService = new FakePolicyQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), policyQueryService });
  const response = await server.inject({ method: "GET", url: "/safety/write-status" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: writeSafetyStatus });
  assert.equal(policyQueryService.writeSafetyCalls.length, 1);
});

test("GET /policy returns 503 when policy query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/policy" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "POLICY_QUERY_SERVICE_UNAVAILABLE",
    message: "Policy query service is not configured."
  });
});

test("GET /safety/write-status returns 503 when policy query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/safety/write-status" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "POLICY_QUERY_SERVICE_UNAVAILABLE",
    message: "Policy query service is not configured."
  });
});

test("GET /settings returns persisted settings snapshot", async () => {
  const settingsQueryService = new FakeSettingsQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), settingsQueryService });
  const response = await server.inject({ method: "GET", url: "/settings" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { settings: settingsSnapshot });
  assert.equal(settingsQueryService.getCalls.length, 1);
});

test("PUT /settings persists settings update", async () => {
  const settingsQueryService = new FakeSettingsQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), settingsQueryService });
  const response = await server.inject({
    method: "PUT",
    url: "/settings",
    payload: {
      settings: {
        project: { defaultMode: "read-only" },
        retention: { evidenceDays: 14 },
        ui: { theme: "light" }
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    settings: {
      ...settingsSnapshot,
      project: { ...settingsSnapshot.project, defaultMode: "read-only" },
      retention: { ...settingsSnapshot.retention, evidenceDays: 14 },
      ui: { ...settingsSnapshot.ui, theme: "light" },
      updatedAt: "2026-05-31T00:05:00.000Z"
    }
  });
  assert.deepEqual(settingsQueryService.updateCalls, [
    {
      project: { defaultMode: "read-only" },
      retention: { evidenceDays: 14 },
      ui: { theme: "light" }
    }
  ]);
});

test("GET /settings returns 503 when settings query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/settings" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "SETTINGS_QUERY_SERVICE_UNAVAILABLE",
    message: "Settings query service is not configured."
  });
});

test("PUT /settings validates request payload", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), settingsQueryService: new FakeSettingsQueryService() });
  const response = await server.inject({
    method: "PUT",
    url: "/settings",
    payload: { settings: {} }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid settings update request."
  });
});

test("PUT /settings returns 503 when settings query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({
    method: "PUT",
    url: "/settings",
    payload: { settings: { ui: { theme: "dark" } } }
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "SETTINGS_QUERY_SERVICE_UNAVAILABLE",
    message: "Settings query service is not configured."
  });
});

test("GET /reviews returns review queue entries", async () => {
  const reviewQueryService = new FakeReviewQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    reviewQueryService
  });
  const response = await server.inject({ method: "GET", url: "/reviews" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { reviews: [reviewItem] });
  assert.equal(reviewQueryService.listCalls.length, 1);
});

test("GET /reviews returns 503 when review query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/reviews" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "REVIEW_QUERY_SERVICE_UNAVAILABLE",
    message: "Review query service is not configured."
  });
});

test("POST /reviews/:reviewId/comments appends a review comment", async () => {
  const reviewQueryService = new FakeReviewQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    reviewQueryService
  });
  const response = await server.inject({
    method: "POST",
    url: "/reviews/run-1/comments",
    payload: { author: "operator", message: "please rerun reviewer" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal((response.json() as { review: ReviewItemView }).review.commentCount, 2);
  assert.deepEqual(reviewQueryService.commentCalls, [{ reviewId: "run-1", author: "operator", message: "please rerun reviewer" }]);
});

test("POST /reviews/:reviewId/comments returns 404 for unknown review", async () => {
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    reviewQueryService: new FakeReviewQueryService()
  });
  const response = await server.inject({
    method: "POST",
    url: "/reviews/missing/comments",
    payload: { message: "missing" }
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "REVIEW_NOT_FOUND",
    message: "Review not found."
  });
});

test("POST /reviews/:reviewId/approval records review decision", async () => {
  const reviewQueryService = new FakeReviewQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    reviewQueryService
  });
  const response = await server.inject({
    method: "POST",
    url: "/reviews/run-1/approval",
    payload: { decision: "approved", author: "lead", note: "looks good" }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { review: ReviewItemView };
  assert.equal(payload.review.status, "approved");
  assert.equal(payload.review.decision?.decision, "approved");
  assert.deepEqual(reviewQueryService.decisionCalls, [{ reviewId: "run-1", decision: "approved", author: "lead", note: "looks good" }]);
});

test("GET /runs lists runs through the query service", async () => {
  const runQueryService = new FakeRunQueryService();
  const server = createApiServer({ runQueryService });
  const response = await server.inject({ method: "GET", url: "/runs" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { runs: [runSummary, completedRunSummary] });
  assert.deepEqual(runQueryService.listCalls, [{}]);
});

test("GET /runs filters runs by status through the query service", async () => {
  const runQueryService = new FakeRunQueryService();
  const server = createApiServer({ runQueryService });
  const response = await server.inject({ method: "GET", url: "/runs?status=passed" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { runs: [completedRunSummary] });
  assert.deepEqual(runQueryService.listCalls, [{ status: "passed" }]);
});

test("GET /runs rejects invalid status query values", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs?status=invalid" });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid run list query."
  });
});

test("GET /runs/compare returns run comparison view", async () => {
  const runComparisonQueryService = new FakeRunComparisonQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    runComparisonQueryService
  });
  const response = await server.inject({ method: "GET", url: "/runs/compare?runA=run-1&runB=run-2" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comparison: runComparisonView });
  assert.deepEqual(runComparisonQueryService.compareCalls, [{ runIdA: "run-1", runIdB: "run-2" }]);
});

test("GET /runs/compare returns 404 when comparison cannot be built", async () => {
  const runComparisonQueryService = new FakeRunComparisonQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    runComparisonQueryService
  });
  const response = await server.inject({ method: "GET", url: "/runs/compare?runA=run-1&runB=missing" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "RUN_COMPARISON_NOT_FOUND",
    message: "Could not compare runs. Ensure both run ids exist and are distinct."
  });
});

test("GET /runs/compare validates required run ids", async () => {
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    runComparisonQueryService: new FakeRunComparisonQueryService()
  });
  const response = await server.inject({ method: "GET", url: "/runs/compare?runA=run-1" });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid run comparison request. Provide runA and runB query parameters."
  });
});

test("GET /runs/compare returns 503 when run comparison service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs/compare?runA=run-1&runB=run-2" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "RUN_COMPARISON_QUERY_SERVICE_UNAVAILABLE",
    message: "Run comparison query service is not configured."
  });
});

test("GET /runs/:runId returns run details through the query service", async () => {
  const runQueryService = new FakeRunQueryService();
  const server = createApiServer({ runQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { run: runDetail });
  assert.deepEqual(runQueryService.getCalls, [{ runId: "run-1" }]);
});

test("GET /runs/:runId returns 404 for missing runs", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs/missing" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "RUN_NOT_FOUND",
    message: "Run not found."
  });
});

test("GET /runs/:runId/readiness returns readiness view", async () => {
  const runInsightsQueryService = new FakeRunInsightsQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), runInsightsQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/readiness" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { readiness: runReadinessView });
  assert.deepEqual(runInsightsQueryService.readinessCalls, ["run-1"]);
});

test("GET /runs/:runId/review returns review view", async () => {
  const runInsightsQueryService = new FakeRunInsightsQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), runInsightsQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/review" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { review: runReviewView });
  assert.deepEqual(runInsightsQueryService.reviewCalls, ["run-1"]);
});

test("GET /runs/:runId/evidence returns evidence view", async () => {
  const runInsightsQueryService = new FakeRunInsightsQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), runInsightsQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/evidence" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { evidence: runEvidenceView });
  assert.deepEqual(runInsightsQueryService.evidenceCalls, ["run-1"]);
});

test("GET /runs/:runId/audit-events returns audited flow events", async () => {
  const auditedFlowAuditQueryService = new FakeAuditedFlowAuditQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), auditedFlowAuditQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/audit-events" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { events: auditedFlowEvents });
  assert.deepEqual(auditedFlowAuditQueryService.listCalls, [{ runId: "run-1" }]);
});

test("GET /runs/:runId/audit-events returns an empty list when audit service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/audit-events" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { events: [] });
});

test("GET /runs/:runId/phase-artifacts returns phase-scoped artifacts", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    artifactQueryService
  });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/phase-artifacts" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { phaseArtifacts: runPhaseArtifactsView });
});

test("GET /runs/:runId/phase-artifacts returns 404 for missing runs", async () => {
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    artifactQueryService: new FakeArtifactQueryService()
  });
  const response = await server.inject({ method: "GET", url: "/runs/missing/phase-artifacts" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "RUN_NOT_FOUND",
    message: "Run not found."
  });
});

test("GET /runs/:runId/phase-artifacts returns 503 when artifact query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/phase-artifacts" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "ARTIFACT_QUERY_SERVICE_UNAVAILABLE",
    message: "Artifact query service is not configured."
  });
});

test("run insight endpoints return 404 for missing runs", async () => {
  const runInsightsQueryService = new FakeRunInsightsQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), runInsightsQueryService });

  const readiness = await server.inject({ method: "GET", url: "/runs/missing/readiness" });
  const review = await server.inject({ method: "GET", url: "/runs/missing/review" });
  const evidence = await server.inject({ method: "GET", url: "/runs/missing/evidence" });

  assert.equal(readiness.statusCode, 404);
  assert.equal(review.statusCode, 404);
  assert.equal(evidence.statusCode, 404);
  assert.deepEqual(readiness.json(), { code: "RUN_NOT_FOUND", message: "Run not found." });
  assert.deepEqual(review.json(), { code: "RUN_NOT_FOUND", message: "Run not found." });
  assert.deepEqual(evidence.json(), { code: "RUN_NOT_FOUND", message: "Run not found." });
});

test("run insight endpoints return 503 when insights service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });

  const readiness = await server.inject({ method: "GET", url: "/runs/run-1/readiness" });
  const review = await server.inject({ method: "GET", url: "/runs/run-1/review" });
  const evidence = await server.inject({ method: "GET", url: "/runs/run-1/evidence" });

  assert.equal(readiness.statusCode, 503);
  assert.equal(review.statusCode, 503);
  assert.equal(evidence.statusCode, 503);
  assert.deepEqual(readiness.json(), {
    code: "RUN_INSIGHTS_QUERY_SERVICE_UNAVAILABLE",
    message: "Run insights query service is not configured."
  });
  assert.deepEqual(review.json(), {
    code: "RUN_INSIGHTS_QUERY_SERVICE_UNAVAILABLE",
    message: "Run insights query service is not configured."
  });
  assert.deepEqual(evidence.json(), {
    code: "RUN_INSIGHTS_QUERY_SERVICE_UNAVAILABLE",
    message: "Run insights query service is not configured."
  });
});

test("GET /runs/:runId/artifacts lists artifacts through the query service", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { artifacts: [planArtifact, reviewArtifact] });
  assert.deepEqual(artifactQueryService.listCalls, [{ runId: "run-1" }]);
});

test("GET /runs/:runId/artifacts filters artifacts by phase", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts?phaseId=planner" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { artifacts: [planArtifact] });
  assert.deepEqual(artifactQueryService.listCalls, [{ runId: "run-1", phaseId: "planner" }]);
});

test("GET /runs/:runId/artifacts returns 503 when artifact service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "ARTIFACT_QUERY_SERVICE_UNAVAILABLE",
    message: "Artifact query service is not configured."
  });
});

test("GET /runs/:runId/artifacts/:artifactId returns artifact metadata", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts/plan" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { artifact: planArtifact });
  assert.deepEqual(artifactQueryService.getCalls, [{ runId: "run-1", artifactId: "plan" }]);
});

test("GET /runs/:runId/artifacts/:artifactId returns 404 for missing artifact metadata", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService: new FakeArtifactQueryService() });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts/missing" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "ARTIFACT_NOT_FOUND",
    message: "Artifact not found."
  });
});

test("GET /runs/:runId/artifacts/:artifactId/content returns artifact content metadata", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts/plan/content?maxBytes=4096" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    artifact: planArtifact,
    content: "content:plan.md",
    truncated: false,
    maxBytes: 4096
  });
  assert.deepEqual(artifactQueryService.contentCalls, [{ runId: "run-1", artifactId: "plan", maxBytes: 4096 }]);
});

test("GET /runs/:runId/artifacts/:artifactId/content returns 404 when content is missing", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts/missing/content" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "ARTIFACT_NOT_FOUND",
    message: "Artifact content not found."
  });
});

test("GET /runs/:runId/artifacts/:artifactId/content validates query bounds", async () => {
  const artifactQueryService = new FakeArtifactQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), artifactQueryService });
  const response = await server.inject({ method: "GET", url: "/runs/run-1/artifacts/plan/content?maxBytes=0" });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid artifact content request."
  });
});

test("GET /stage-plans lists stage plans through the query service", async () => {
  const stagePlanQueryService = new FakeStagePlanQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), stagePlanQueryService });
  const response = await server.inject({ method: "GET", url: "/stage-plans" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { stagePlans: [stagePlanSummary] });
  assert.equal(stagePlanQueryService.listCalls.length, 1);
});

test("GET /stage-plans/:stagePlanId returns stage plan detail", async () => {
  const stagePlanQueryService = new FakeStagePlanQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), stagePlanQueryService });
  const response = await server.inject({ method: "GET", url: `/stage-plans/${stagePlanSummary.id}` });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { stagePlan: stagePlanDetail });
  assert.deepEqual(stagePlanQueryService.getCalls, [stagePlanSummary.id]);
});

test("GET /stage-plans/:stagePlanId returns 404 for missing plans", async () => {
  const stagePlanQueryService = new FakeStagePlanQueryService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), stagePlanQueryService });
  const response = await server.inject({ method: "GET", url: "/stage-plans/missing" });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: "STAGE_PLAN_NOT_FOUND",
    message: "Stage plan not found."
  });
});

test("GET /stage-plans returns 503 when stage plan query service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/stage-plans" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "STAGE_PLAN_QUERY_SERVICE_UNAVAILABLE",
    message: "Stage plan query service is not configured."
  });
});

test("POST /audited-flows executes the audited flow use case", async () => {
  const calls: Array<{ contract: RunContract; dryRun?: boolean }> = [];
  const contract: RunContract = {
    goal: "Validate audited flow route",
    workspace: "/tmp/workspace",
    flow: "feature-standard",
    stages: [{ id: "plan", kind: "plan", executor: "deterministic-dry-run" }]
  };
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    executeAuditedFlow: async (input) => {
      calls.push(input);
      return auditedFlowResult;
    }
  });

  const response = await server.inject({
    method: "POST",
    url: "/audited-flows",
    payload: {
      contract,
      dryRun: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { run: auditedFlowResult });
  assert.deepEqual(calls, [{ contract, dryRun: true }]);
});

test("POST /audited-flows validates payload and service availability", async () => {
  const unavailableServer = createApiServer({ runQueryService: new FakeRunQueryService() });
  const invalid = await unavailableServer.inject({
    method: "POST",
    url: "/audited-flows",
    payload: { contract: { flow: "feature-standard" } }
  });

  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid audited flow request."
  });

  const unavailable = await unavailableServer.inject({
    method: "POST",
    url: "/audited-flows",
    payload: {
      contract: {
        goal: "Validate audited flow route",
        workspace: "/tmp/workspace",
        flow: "feature-standard",
        stages: [{ id: "plan", kind: "plan", executor: "deterministic-dry-run" }]
      }
    }
  });

  assert.equal(unavailable.statusCode, 503);
  assert.deepEqual(unavailable.json(), {
    code: "AUDITED_FLOW_EXECUTION_UNAVAILABLE",
    message: "Audited flow execution is not configured."
  });
});

test("POST /commands executes validated commands through the command service", async () => {
  const commandService = new FakeCommandService();
  const command = createSelectTaskCommand();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), commandService });
  const response = await server.inject({
    method: "POST",
    url: "/commands",
    payload: {
      command,
      options: { confirmationContextId: "ctx-1", confirmationToken: "token-1" }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    result: {
      ok: true,
      commandId: "cmd-1",
      type: "select-task",
      message: "Command accepted"
    }
  });
  assert.deepEqual(commandService.executeCalls, [
    { command, options: { confirmationContextId: "ctx-1", confirmationToken: "token-1" } }
  ]);
});

test("POST /commands rejects invalid command requests", async () => {
  const commandService = new FakeCommandService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), commandService });
  const response = await server.inject({
    method: "POST",
    url: "/commands",
    payload: { command: { type: "select-task" } }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid command request."
  });
  assert.deepEqual(commandService.executeCalls, []);
});

test("POST /commands returns 503 when command service is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({
    method: "POST",
    url: "/commands",
    payload: { command: createSelectTaskCommand() }
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "COMMAND_SERVICE_UNAVAILABLE",
    message: "Command service is not configured."
  });
});

test("POST /commands/preview returns typed command description", async () => {
  const commandService = new FakeCommandService();
  const command = createSelectTaskCommand();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), commandService });
  const response = await server.inject({
    method: "POST",
    url: "/commands/preview",
    payload: {
      command,
      options: { confirmationContextId: "ctx-preview" }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    description: {
      commandId: "cmd-1",
      type: "select-task",
      title: "Fake command",
      summary: "Fake command summary",
      risk: "low",
      requiresConfirmation: false,
      preconditions: [],
      effects: []
    }
  });
});

test("POST /commands/preview validates payload and service availability", async () => {
  const commandService = new FakeCommandService();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), commandService });
  const invalid = await server.inject({
    method: "POST",
    url: "/commands/preview",
    payload: { command: { type: "select-task" } }
  });

  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid command preview request."
  });

  const unavailableServer = createApiServer({ runQueryService: new FakeRunQueryService() });
  const unavailable = await unavailableServer.inject({
    method: "POST",
    url: "/commands/preview",
    payload: { command: createSelectTaskCommand() }
  });

  assert.equal(unavailable.statusCode, 503);
  assert.deepEqual(unavailable.json(), {
    code: "COMMAND_SERVICE_UNAVAILABLE",
    message: "Command service is not configured."
  });
});

test("POST /cli/commands executes CLI-equivalent request through gateway", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-1",
      command: {
        command: "continue-run",
        runId: "run-1",
        executeReviewer: true,
        runChecks: true,
        dryRun: true
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(cliCommandGateway.executeCalls.length, 1);
  assert.deepEqual(response.json(), {
    requestId: "web-1",
    command: "continue-run",
    ok: true,
    exitCode: 0,
    summaryLines: ["Gateway executed"],
    data: { command: "continue-run" }
  });
});

test("POST /cli/commands/preview returns CLI preview contract from gateway", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands/preview",
    payload: {
      requestId: "web-preview-1",
      command: {
        command: "continue-run",
        runId: "run-1",
        executeReviewer: true,
        runChecks: true,
        dryRun: true
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(cliCommandGateway.previewCalls.length, 1);
  assert.deepEqual(response.json(), {
    requestId: "web-preview-1",
    command: "continue-run",
    equivalentCli: "npm run mergewright -- continue-run run-1 --config config.example.json",
    risk: "medium",
    requiresConfirmation: true,
    summaryLines: ["Command: continue-run", "Risk: medium"],
    effects: {
      mayWriteWorkspace: false,
      mayWriteArtifacts: true,
      mayChangeGit: false
    }
  });
});

test("POST /cli/commands/preview validates payload and gateway availability", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const invalid = await server.inject({
    method: "POST",
    url: "/cli/commands/preview",
    payload: {
      requestId: "web-preview-invalid",
      command: {
        command: "continue-run"
      }
    }
  });

  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid CLI command preview request."
  });

  const unavailableServer = createApiServer({ runQueryService: new FakeRunQueryService() });
  const unavailable = await unavailableServer.inject({
    method: "POST",
    url: "/cli/commands/preview",
    payload: {
      requestId: "web-preview-unavailable",
      command: {
        command: "continue-run",
        runId: "run-1"
      }
    }
  });

  assert.equal(unavailable.statusCode, 503);
  assert.deepEqual(unavailable.json(), {
    code: "CLI_COMMAND_GATEWAY_UNAVAILABLE",
    message: "CLI command gateway is not configured."
  });
});

test("POST /cli/commands accepts fix-stage payloads through gateway", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-fix-1",
      command: {
        command: "fix-stage",
        stageId: "stage-01-provider-contract",
        stagePlanArg: ".artifacts/runs/provider-contract/stage-plan.json",
        feedback: "Fix stale wording and rerun checks.",
        allowWrites: true,
        reassessDownstream: true
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    requestId: "web-fix-1",
    command: "fix-stage",
    ok: true,
    exitCode: 0,
    summaryLines: ["Gateway executed"],
    data: { command: "fix-stage" }
  });
});

test("POST /cli/commands accepts check-write-safety payloads through gateway", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-safety-1",
      command: {
        command: "check-write-safety"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    requestId: "web-safety-1",
    command: "check-write-safety",
    ok: true,
    exitCode: 0,
    summaryLines: ["Gateway executed"],
    data: { command: "check-write-safety" }
  });
});

test("POST /cli/commands accepts probe-opencode payloads through gateway", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-probe-1",
      command: {
        command: "probe-opencode",
        validateReadonlyContract: true
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    requestId: "web-probe-1",
    command: "probe-opencode",
    ok: true,
    exitCode: 0,
    summaryLines: ["Gateway executed"],
    data: { command: "probe-opencode" }
  });
});

test("POST /cli/commands publishes started and completed events", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const events: CliCommandEvent[] = [];
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    cliCommandGateway,
    onCliCommandEvent: (event) => events.push(event)
  });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-events-1",
      command: {
        command: "continue-run",
        runId: "run-1"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.status, "started");
  assert.equal(events[0]?.command, "continue-run");
  assert.equal(events[1]?.status, "completed");
  assert.equal(events[1]?.ok, true);
  assert.equal(events[1]?.exitCode, 0);
});

test("POST /cli/commands publishes failed events for non-zero command results", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const events: CliCommandEvent[] = [];
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    cliCommandGateway,
    onCliCommandEvent: (event) => events.push(event)
  });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-events-2",
      command: {
        command: "prove",
        runId: "run-1"
      }
    }
  });

  assert.equal(response.statusCode, 422);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.status, "started");
  assert.equal(events[1]?.status, "failed");
  assert.equal(events[1]?.ok, false);
  assert.equal(events[1]?.exitCode, 1);
});

test("GET /cli/events/recent returns stored command lifecycle events", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    cliCommandGateway
  });

  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "recent-1", command: { command: "continue-run", runId: "run-1" } }
  });
  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "recent-2", command: { command: "prove", runId: "run-1" } }
  });

  const response = await server.inject({ method: "GET", url: "/cli/events/recent?limit=3" });
  assert.equal(response.statusCode, 200);
  const payload = response.json() as { events: Array<{ status: string; command: string }> };
  assert.equal(payload.events.length, 3);
  assert.equal(payload.events[0]?.status, "completed");
  assert.equal(payload.events[1]?.status, "started");
  assert.equal(payload.events[2]?.status, "failed");
  assert.equal(payload.events[2]?.command, "prove");
});

test("GET /commands/:commandId/events filters lifecycle events by requestId", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    cliCommandGateway
  });

  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "request-1", command: { command: "continue-run", runId: "run-1" } }
  });
  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "request-2", command: { command: "prove", runId: "run-2" } }
  });

  const response = await server.inject({ method: "GET", url: "/commands/request-1/events?limit=10" });
  assert.equal(response.statusCode, 200);
  const payload = response.json() as { events: Array<{ requestId?: string; command: string; runId?: string }> };
  assert.equal(payload.events.length, 2);
  assert.equal(payload.events[0]?.requestId, "request-1");
  assert.equal(payload.events[0]?.command, "continue-run");
  assert.equal(payload.events[0]?.runId, "run-1");
  assert.equal(payload.events[1]?.requestId, "request-1");
});

test("GET /runs/:runId/events filters lifecycle events by run context", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({
    runQueryService: new FakeRunQueryService(),
    cliCommandGateway
  });

  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "run-event-1", command: { command: "continue-run", runId: "run-1" } }
  });
  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "run-event-2", command: { command: "prove", runId: "run-2" } }
  });
  await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: { requestId: "run-event-3", command: { command: "compare-runs", runIdA: "run-1", runIdB: "run-9" } }
  });

  const response = await server.inject({ method: "GET", url: "/runs/run-1/events?limit=10" });
  assert.equal(response.statusCode, 200);
  const payload = response.json() as { events: Array<{ runId?: string; relatedRunIds?: string[]; command: string }> };
  assert.equal(payload.events.length, 4);
  assert.equal(payload.events[0]?.runId, "run-1");
  assert.equal(payload.events[2]?.command, "compare-runs");
  assert.equal(payload.events[2]?.relatedRunIds?.includes("run-1"), true);
});

test("command and run event endpoints validate request parameters", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway: new FakeCliCommandGateway() });

  const invalidCommandEvents = await server.inject({ method: "GET", url: "/commands/request/events?limit=0" });
  assert.equal(invalidCommandEvents.statusCode, 400);
  assert.deepEqual(invalidCommandEvents.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid command events request."
  });

  const invalidRunEvents = await server.inject({ method: "GET", url: "/runs/run-1/events?limit=0" });
  assert.equal(invalidRunEvents.statusCode, 400);
  assert.deepEqual(invalidRunEvents.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid run events request."
  });
});

test("GET /cli/events/recent validates limit range", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway: new FakeCliCommandGateway() });
  const response = await server.inject({ method: "GET", url: "/cli/events/recent?limit=0" });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid recent event query. limit must be an integer between 1 and 500."
  });
});

test("POST /cli/commands returns 422 when gateway reports command failure", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-2",
      command: {
        command: "prove",
        runId: "run-1"
      }
    }
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.json(), {
    requestId: "web-2",
    command: "prove",
    ok: false,
    exitCode: 1,
    summaryLines: ["Gateway executed"],
    data: { command: "prove" },
    error: "prove failed: BLOCKED"
  });
});

test("POST /cli/commands returns 503 when gateway is missing", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-3",
      command: {
        command: "prove",
        runId: "run-1"
      }
    }
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    code: "CLI_COMMAND_GATEWAY_UNAVAILABLE",
    message: "CLI command gateway is not configured."
  });
});

test("POST /cli/commands rejects invalid requests", async () => {
  const cliCommandGateway = new FakeCliCommandGateway();
  const server = createApiServer({ runQueryService: new FakeRunQueryService(), cliCommandGateway });
  const response = await server.inject({
    method: "POST",
    url: "/cli/commands",
    payload: {
      requestId: "web-4",
      command: {
        command: "continue-run"
      }
    }
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: "VALIDATION_FAILED",
    message: "Invalid CLI command request."
  });
});
