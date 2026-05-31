import { z } from "zod";

export const runStatusSchema = z.enum(["pending", "running", "passed", "failed", "blocked", "cancelled", "unknown"]);
export const runPhaseStatusSchema = z.enum(["pending", "running", "passed", "failed", "blocked", "skipped", "unknown"]);
export const runModeSchema = z.enum(["dry-run", "read-only", "write-enabled", "auto-chain", "unknown"]);
export const runArtefactKindSchema = z.enum(["markdown", "json", "log", "diff", "text"]);

export const runSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: runStatusSchema,
  subtitle: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  branch: z.string().optional(),
  mode: runModeSchema,
  warnings: z.array(z.string())
});

export const runPhaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: runPhaseStatusSchema,
  summary: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMs: z.number().optional(),
  artefactIds: z.array(z.string()),
  blockedReason: z.string().optional()
});

export const runArtefactSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: runArtefactKindSchema,
  path: z.string(),
  phaseId: z.string().optional(),
  sizeBytes: z.number().optional()
});

export const safeActionSchema = z.object({
  id: z.enum(["continue", "request-fix", "generate-report", "generate-pr-summary", "open-artefact", "open-run-folder", "rerun-reviewer", "stop"]),
  label: z.string(),
  enabled: z.boolean(),
  blockedReason: z.string().optional(),
  risk: z.enum(["low", "medium", "high"]),
  requiresConfirmation: z.boolean()
});

export const reviewFindingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  message: z.string(),
  sourceArtefactId: z.string().optional()
});

export const runReadinessSchema = z.object({
  source: z.enum(["report", "evidence", "fallback"]),
  status: z.enum(["READY", "NEEDS_REVIEW", "NEEDS_FIX", "BLOCKED", "unknown"]),
  score: z.number().optional(),
  risk: z.enum(["low", "medium", "high", "unknown"]).optional(),
  checksState: z.enum(["passed", "failed", "skipped", "unknown"]).optional(),
  reviewerVerdict: z.enum(["PASS", "FAIL", "unavailable", "UNKNOWN"]).optional(),
  changedFileCount: z.number().int().nonnegative().optional(),
  missingEvidenceWarnings: z.array(z.string())
});

export const runDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal: z.string().optional(),
  status: runStatusSchema,
  workspaceRoot: z.string().optional(),
  runDir: z.string(),
  branch: z.string().optional(),
  mode: runModeSchema,
  provider: z.string().optional(),
  model: z.string().optional(),
  phases: z.array(runPhaseSchema),
  artefacts: z.array(runArtefactSchema),
  safeActions: z.array(safeActionSchema),
  blockedReason: z.string().optional(),
  reviewerFindings: z.array(reviewFindingSchema),
  readiness: runReadinessSchema.optional(),
  warnings: z.array(z.string())
});

export const appCommandTypeSchema = z.enum(["select-task", "update-coordination-note", "mark-task-reviewed", "add-task-comment", "start-run", "continue-run", "retry-phase", "execute-builder", "approve-stage", "reassess-stage-plan"]);
export const commandSourceSchema = z.enum(["cli", "tui", "mcp", "automation"]);
export const appCommandSchema = z.object({
  commandId: z.string().min(1),
  source: commandSourceSchema,
  requestedAt: z.string().min(1),
  type: appCommandTypeSchema,
  actor: z.object({ id: z.string().optional(), displayName: z.string().optional() }).optional()
}).passthrough();
export const commandExecutionOptionsSchema = z.object({
  confirmationContextId: z.string().optional(),
  confirmationToken: z.string().optional()
});
export const submitCommandRequestSchema = z.object({
  command: appCommandSchema,
  options: commandExecutionOptionsSchema.optional()
});

export const previewCommandRequestSchema = submitCommandRequestSchema;

export const commandDescriptionSchema = z.object({
  commandId: z.string().min(1),
  type: appCommandTypeSchema,
  title: z.string(),
  summary: z.string(),
  risk: z.enum(["none", "low", "medium", "high"]),
  requiresConfirmation: z.boolean(),
  preconditions: z.array(z.string()),
  effects: z.array(z.string()),
  blockedReason: z.string().optional()
});

export const previewCommandResponseSchema = z.object({
  description: commandDescriptionSchema
});
export const appCommandSuccessResultSchema = z.object({
  ok: z.literal(true),
  commandId: z.string(),
  type: appCommandTypeSchema,
  message: z.string(),
  changedFiles: z.array(z.string()).optional(),
  artefacts: z.array(z.string()).optional(),
  runId: z.string().optional(),
  stageId: z.string().optional(),
  warnings: z.array(z.string()).optional()
});
export const appCommandFailureResultSchema = z.object({
  ok: z.literal(false),
  commandId: z.string(),
  type: appCommandTypeSchema,
  code: z.enum(["VALIDATION_FAILED", "CONFIRMATION_REQUIRED", "WRITE_SAFETY_FAILED", "NOT_FOUND", "CONFLICT", "EXECUTION_FAILED"]),
  reason: z.string(),
  details: z.unknown().optional()
});
export const appCommandResultSchema = z.discriminatedUnion("ok", [appCommandSuccessResultSchema, appCommandFailureResultSchema]);
export const submitCommandResponseSchema = z.object({ result: appCommandResultSchema });

export const commandEventSchema = z.object({
  timestamp: z.string(),
  requestId: z.string().optional(),
  command: z.string(),
  status: z.enum(["started", "completed", "failed"]),
  exitCode: z.number().int().optional(),
  ok: z.boolean().optional(),
  error: z.string().optional(),
  runId: z.string().optional(),
  relatedRunIds: z.array(z.string()).optional(),
  stageId: z.string().optional(),
  stagePlanArg: z.string().optional()
});

export const listCommandEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const getCommandEventsParamsSchema = z.object({
  commandId: z.string().min(1)
});

export const getRunEventsResponseSchema = z.object({
  events: z.array(commandEventSchema)
});

export const getCommandEventsResponseSchema = z.object({
  events: z.array(commandEventSchema)
});

export const cliCommandPreviewResponseSchema = z.object({
  requestId: z.string().optional(),
  command: z.string(),
  equivalentCli: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  requiresConfirmation: z.boolean(),
  summaryLines: z.array(z.string()),
  effects: z.object({
    mayWriteWorkspace: z.boolean(),
    mayWriteArtifacts: z.boolean(),
    mayChangeGit: z.boolean()
  })
});

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("mergewright-api")
});

export const listRunsQuerySchema = z.object({
  status: runStatusSchema.or(z.literal("all")).optional(),
  projectId: z.string().min(1).optional()
});

export const listRunsResponseSchema = z.object({
  runs: z.array(runSummarySchema)
});

export const getRunComparisonQuerySchema = z.object({
  runA: z.string().min(1),
  runB: z.string().min(1),
  projectId: z.string().min(1).optional()
});

export const comparedRunSummarySchema = z.object({
  runId: z.string(),
  status: z.enum(["READY", "NEEDS_REVIEW", "NEEDS_FIX", "BLOCKED"]),
  score: z.number(),
  risk: z.enum(["low", "medium", "high"]),
  reviewerVerdict: z.enum(["PASS", "FAIL", "unavailable"]),
  checksState: z.enum(["passed", "failed", "skipped", "unknown"]),
  changedFileCount: z.number().int().nonnegative(),
  acceptanceCriteria: z.object({
    expected: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative()
  }),
  missingEvidenceWarnings: z.array(z.string())
});

export const runComparisonViewSchema = z.object({
  version: z.literal(1),
  runA: comparedRunSummarySchema,
  runB: comparedRunSummarySchema,
  deltas: z.object({
    score: z.number(),
    risk: z.enum(["higher", "lower", "same"]),
    readinessChanged: z.boolean(),
    checksChanged: z.boolean(),
    reviewerChanged: z.boolean(),
    changedFileCount: z.number()
  }),
  changedFiles: z.object({
    onlyInA: z.array(z.string()),
    onlyInB: z.array(z.string()),
    inBothCount: z.number().int().nonnegative()
  }),
  checks: z.object({
    failedOnlyInA: z.array(z.string()),
    failedOnlyInB: z.array(z.string())
  }),
  acceptance: z.object({
    regressions: z.array(z.string()),
    improvements: z.array(z.string())
  })
});

export const getRunComparisonResponseSchema = z.object({
  comparison: runComparisonViewSchema
});

export const getRunParamsSchema = z.object({
  runId: z.string().min(1)
});

export const getRunResponseSchema = z.object({
  run: runDetailSchema
});

export const runPhaseArtifactsItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: runPhaseStatusSchema,
  artifacts: z.array(runArtefactSchema)
});

export const runPhaseArtifactsViewSchema = z.object({
  runId: z.string(),
  phases: z.array(runPhaseArtifactsItemSchema),
  unassignedArtifacts: z.array(runArtefactSchema)
});

export const getRunPhaseArtifactsResponseSchema = z.object({
  phaseArtifacts: runPhaseArtifactsViewSchema
});

export const runReadinessViewSchema = z.object({
  runId: z.string(),
  ready: z.boolean(),
  status: runReadinessSchema.shape.status,
  score: z.number().optional(),
  risk: runReadinessSchema.shape.risk.optional(),
  checksState: runReadinessSchema.shape.checksState.optional(),
  reviewerVerdict: runReadinessSchema.shape.reviewerVerdict.optional(),
  missingEvidenceWarnings: z.array(z.string()),
  blockedReason: z.string().optional(),
  nextAction: z.enum([
    "continue",
    "request-fix",
    "generate-report",
    "generate-pr-summary",
    "open-artefact",
    "open-run-folder",
    "rerun-reviewer",
    "stop",
    "ready-to-merge",
    "inspect-blockers"
  ])
});

export const getRunReadinessResponseSchema = z.object({
  readiness: runReadinessViewSchema
});

export const runReviewViewSchema = z.object({
  runId: z.string(),
  verdict: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  blockingFindings: z.array(reviewFindingSchema),
  nonBlockingFindings: z.array(reviewFindingSchema),
  recommendedFixPrompt: z.string().optional(),
  testsObservedCount: z.number().int().nonnegative().optional(),
  acceptanceCriteriaCount: z.number().int().nonnegative().optional()
});

export const getRunReviewResponseSchema = z.object({
  review: runReviewViewSchema
});

export const runEvidenceItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["pass", "fail", "missing", "unknown"]),
  blocking: z.boolean(),
  note: z.string().optional(),
  sourcePath: z.string().optional()
});

export const runEvidenceViewSchema = z.object({
  runId: z.string(),
  available: z.boolean(),
  status: z.string(),
  blockerCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  items: z.array(runEvidenceItemSchema)
});

export const getRunEvidenceResponseSchema = z.object({
  evidence: runEvidenceViewSchema
});

export const reviewStatusSchema = z.enum(["pending", "ready", "approved", "changes_requested"]);
export const reviewDecisionSchema = z.enum(["approved", "changes_requested"]);

export const reviewCommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  message: z.string(),
  createdAt: z.string()
});

export const reviewDecisionViewSchema = z.object({
  decision: reviewDecisionSchema,
  author: z.string(),
  note: z.string().optional(),
  decidedAt: z.string()
});

export const reviewItemSchema = z.object({
  id: z.string(),
  runId: z.string(),
  title: z.string(),
  status: reviewStatusSchema,
  readinessStatus: runReadinessSchema.shape.status,
  reviewerVerdict: runReadinessSchema.shape.reviewerVerdict.optional().default("UNKNOWN"),
  checksState: runReadinessSchema.shape.checksState.optional().default("unknown"),
  blockerCount: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
  commentCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
  comments: z.array(reviewCommentSchema),
  decision: reviewDecisionViewSchema.optional()
});

export const listReviewsResponseSchema = z.object({
  reviews: z.array(reviewItemSchema)
});

export const reviewIdParamsSchema = z.object({
  reviewId: z.string().min(1)
});

export const addReviewCommentRequestSchema = z.object({
  author: z.string().min(1).max(120).optional(),
  message: z.string().min(1).max(4000)
});

export const addReviewCommentResponseSchema = z.object({
  review: reviewItemSchema
});

export const decideReviewRequestSchema = z.object({
  decision: reviewDecisionSchema,
  author: z.string().min(1).max(120).optional(),
  note: z.string().min(1).max(2000).optional()
});

export const decideReviewResponseSchema = z.object({
  review: reviewItemSchema
});

export const listRunArtifactsParamsSchema = z.object({
  runId: z.string().min(1)
});

export const listRunArtifactsQuerySchema = z.object({
  phaseId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional()
});

export const listRunArtifactsResponseSchema = z.object({
  artifacts: z.array(runArtefactSchema)
});

export const getRunArtifactParamsSchema = z.object({
  runId: z.string().min(1),
  artifactId: z.string().min(1)
});

export const getRunArtifactResponseSchema = z.object({
  artifact: runArtefactSchema
});

export const getRunArtifactContentQuerySchema = z.object({
  maxBytes: z.coerce.number().int().min(1).max(1_000_000).optional(),
  projectId: z.string().min(1).optional()
});

export const getRunArtifactContentResponseSchema = z.object({
  artifact: runArtefactSchema,
  content: z.string(),
  truncated: z.boolean(),
  maxBytes: z.number().int().positive()
});

export const stagePlanStatusSchema = z.enum(["draft", "ready", "running", "paused", "completed", "failed"]);
export const stageStatusSchema = z.enum([
  "pending",
  "running",
  "review_required",
  "accepted",
  "fix_required",
  "fixing",
  "passed",
  "failed",
  "committed",
  "needs_revision",
  "invalidated",
  "skipped"
]);

export const stagePlanSummarySchema = z.object({
  id: z.string(),
  planId: z.string(),
  title: z.string(),
  goal: z.string(),
  source: z.enum(["generated", "imported", "manual"]),
  status: stagePlanStatusSchema,
  updatedAt: z.string(),
  stageCount: z.number().int().nonnegative(),
  path: z.string()
});

export const stagePlanStageSummarySchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  title: z.string(),
  status: stageStatusSchema,
  dependsOn: z.array(z.string()),
  revision: z.number().int().positive(),
  commitSha: z.string().optional(),
  acceptanceCriteriaCount: z.number().int().nonnegative(),
  checksCount: z.number().int().nonnegative()
});

export const stagePlanStatusCountsSchema = z.object({
  pending: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  reviewRequired: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  fixRequired: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  committed: z.number().int().nonnegative()
});

export const stagePlanDetailSchema = z.object({
  id: z.string(),
  planId: z.string(),
  title: z.string(),
  goal: z.string(),
  source: z.enum(["generated", "imported", "manual"]),
  status: stagePlanStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  path: z.string(),
  stageCount: z.number().int().nonnegative(),
  statusCounts: stagePlanStatusCountsSchema,
  stages: z.array(stagePlanStageSummarySchema)
});

export const listStagePlansResponseSchema = z.object({
  stagePlans: z.array(stagePlanSummarySchema)
});

export const getStagePlanParamsSchema = z.object({
  stagePlanId: z.string().min(1)
});

export const getStagePlanResponseSchema = z.object({
  stagePlan: stagePlanDetailSchema
});

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  configPath: z.string(),
  workspaceRoot: z.string(),
  runsRoot: z.string(),
  defaultProvider: z.string()
});

export const projectDetailSchema = projectSummarySchema.extend({
  orchestratorRoot: z.string(),
  stagesRoot: z.string(),
  promptsRoot: z.string(),
  providers: z.array(z.string())
});

export const projectHealthSchema = z.object({
  projectId: z.string(),
  healthy: z.boolean(),
  checks: z.object({
    configPathExists: z.boolean(),
    workspaceRootExists: z.boolean(),
    runsRootExists: z.boolean(),
    stagesRootExists: z.boolean(),
    promptsRootExists: z.boolean()
  }),
  warnings: z.array(z.string())
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSummarySchema)
});

export const getProjectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const getProjectResponseSchema = z.object({
  project: projectDetailSchema
});

export const getProjectHealthResponseSchema = z.object({
  health: projectHealthSchema
});

export const createProjectRequestSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    configPath: z.string().min(1)
  })
});

export const initProjectRequestSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    workspacePath: z.string().min(1),
    force: z.boolean().optional()
  })
});

export const updateProjectRequestSchema = z.object({
  project: z
    .object({
      name: z.string().min(1).optional(),
      configPath: z.string().min(1).optional()
    })
    .refine((value) => value.name !== undefined || value.configPath !== undefined, {
      message: "At least one project field is required."
    })
});

export const createProjectResponseSchema = z.object({
  project: projectDetailSchema
});

export const initProjectResponseSchema = z.object({
  project: projectDetailSchema
});

export const updateProjectResponseSchema = z.object({
  project: projectDetailSchema
});

export const deleteProjectResponseSchema = z.object({
  ok: z.literal(true)
});

export const settingsDefaultModeSchema = z.enum(["preview-first", "read-only", "write-enabled"]);
export const settingsThemeSchema = z.enum(["system", "light", "dark"]);

export const settingsProjectSchema = z.object({
  activeProjectId: z.string().min(1),
  defaultConfigPath: z.string().min(1),
  runsRoot: z.string().min(1),
  defaultProvider: z.string().min(1),
  defaultModel: z.string().min(1),
  defaultMode: settingsDefaultModeSchema
});

export const settingsRetentionSchema = z.object({
  evidenceDays: z.number().int().min(1),
  artifactDays: z.number().int().min(1)
});

export const settingsUiSchema = z.object({
  theme: settingsThemeSchema,
  keyboardShortcuts: z.boolean()
});

export const settingsSnapshotSchema = z.object({
  version: z.literal(1),
  project: settingsProjectSchema,
  retention: settingsRetentionSchema,
  ui: settingsUiSchema,
  updatedAt: z.string().min(1)
});

export const getSettingsResponseSchema = z.object({
  settings: settingsSnapshotSchema
});

export const updateSettingsPayloadSchema = z
  .object({
    project: settingsProjectSchema.partial().optional(),
    retention: settingsRetentionSchema.partial().optional(),
    ui: settingsUiSchema.partial().optional()
  })
  .refine((value) => value.project !== undefined || value.retention !== undefined || value.ui !== undefined, {
    message: "At least one settings section is required."
  });

export const updateSettingsRequestSchema = z.object({
  settings: updateSettingsPayloadSchema
});

export const updateSettingsResponseSchema = z.object({
  settings: settingsSnapshotSchema
});

export const providerSummarySchema = z.object({
  id: z.string(),
  type: z.enum(["codex-cli", "opencode-cli"]),
  command: z.string(),
  usedByRoles: z.array(z.string()),
  supportsReadOnly: z.boolean(),
  supportsWrites: z.boolean(),
  supportsProbe: z.boolean()
});

export const providerInventorySchema = z.object({
  defaultProvider: z.string(),
  providers: z.array(providerSummarySchema)
});

export const getProvidersResponseSchema = z.object({
  inventory: providerInventorySchema
});

export const policySnapshotSchema = z.object({
  requireGitRepo: z.boolean(),
  requireCleanStart: z.boolean(),
  manualCommitOnly: z.boolean(),
  forbidAutoCommit: z.boolean(),
  forbidAutoPush: z.boolean(),
  writeSafetyEnabled: z.boolean(),
  requireCleanWorkingTree: z.boolean(),
  requireExplicitAllowWrites: z.boolean(),
  requireReviewAfterWrites: z.boolean(),
  allowedBranches: z.array(z.string()),
  blockedPaths: z.array(z.string()),
  checkCount: z.number().int().nonnegative()
});

export const getPolicyResponseSchema = z.object({
  policy: policySnapshotSchema
});

export const writeSafetyStatusSchema = z.object({
  checkedAt: z.string(),
  ok: z.boolean(),
  summary: z.string(),
  failures: z.array(z.string()),
  warnings: z.array(z.string()),
  enabled: z.boolean(),
  branch: z.string(),
  isGitWorkTree: z.boolean(),
  workingTreeState: z.enum(["clean", "dirty", "unknown"]),
  changedFilesCount: z.number().int().nonnegative(),
  blockedMatchCount: z.number().int().nonnegative()
});

export const getWriteSafetyStatusResponseSchema = z.object({
  status: writeSafetyStatusSchema
});

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});
