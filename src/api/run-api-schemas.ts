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

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("mergewright-api")
});

export const listRunsQuerySchema = z.object({
  status: runStatusSchema.or(z.literal("all")).optional()
});

export const listRunsResponseSchema = z.object({
  runs: z.array(runSummarySchema)
});

export const getRunParamsSchema = z.object({
  runId: z.string().min(1)
});

export const getRunResponseSchema = z.object({
  run: runDetailSchema
});

export const listRunArtifactsParamsSchema = z.object({
  runId: z.string().min(1)
});

export const listRunArtifactsQuerySchema = z.object({
  phaseId: z.string().min(1).optional()
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

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string()
});