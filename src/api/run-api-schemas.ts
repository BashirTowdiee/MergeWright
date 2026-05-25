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