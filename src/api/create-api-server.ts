import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { AppCommand } from "../application/commands/app-command.js";
import type { AppCommandService } from "../application/commands/app-command-service.js";
import type { ArtifactQueryService } from "../application/queries/artifact-query-service.js";
import type { PolicyQueryService } from "../application/queries/policy-query-service.js";
import type { ProjectQueryService } from "../application/queries/project-query-service.js";
import type { ProviderQueryService } from "../application/queries/provider-query-service.js";
import type { ReviewQueryService } from "../application/queries/review-query-service.js";
import type { RunComparisonQueryService } from "../application/queries/run-comparison-query-service.js";
import type { RunInsightsQueryService } from "../application/queries/run-insights-query-service.js";
import type { RunQueryService } from "../application/queries/run-query-service.js";
import type { SettingsQueryService } from "../application/queries/settings-query-service.js";
import type { StagePlanQueryService } from "../application/queries/stage-plan-query-service.js";
import {
  addReviewCommentRequestSchema,
  addReviewCommentResponseSchema,
  cliCommandPreviewResponseSchema,
  decideReviewRequestSchema,
  decideReviewResponseSchema,
  errorResponseSchema,
  getCommandEventsParamsSchema,
  getCommandEventsResponseSchema,
  getRunComparisonQuerySchema,
  getRunComparisonResponseSchema,
  getPolicyResponseSchema,
  getProvidersResponseSchema,
  getProjectHealthResponseSchema,
  createProjectRequestSchema,
  createProjectResponseSchema,
  updateProjectRequestSchema,
  updateProjectResponseSchema,
  deleteProjectResponseSchema,
  getProjectParamsSchema,
  getProjectResponseSchema,
  getSettingsResponseSchema,
  getRunEvidenceResponseSchema,
  getRunReadinessResponseSchema,
  getRunReviewResponseSchema,
  getStagePlanParamsSchema,
  getStagePlanResponseSchema,
  getRunArtifactContentQuerySchema,
  getRunArtifactContentResponseSchema,
  getRunArtifactParamsSchema,
  getRunArtifactResponseSchema,
  getRunParamsSchema,
  getRunPhaseArtifactsResponseSchema,
  getRunResponseSchema,
  getRunEventsResponseSchema,
  getWriteSafetyStatusResponseSchema,
  healthResponseSchema,
  listCommandEventsQuerySchema,
  listProjectsResponseSchema,
  listReviewsResponseSchema,
  listStagePlansResponseSchema,
  listRunArtifactsParamsSchema,
  listRunArtifactsQuerySchema,
  listRunArtifactsResponseSchema,
  listRunsQuerySchema,
  listRunsResponseSchema,
  previewCommandRequestSchema,
  previewCommandResponseSchema,
  submitCommandRequestSchema,
  submitCommandResponseSchema,
  updateSettingsRequestSchema,
  updateSettingsResponseSchema,
  reviewIdParamsSchema
} from "./run-api-schemas.js";
import { cliGatewayRequestSchema, type CliCommandGateway, type CliGatewayRequest } from "./cli-command-gateway.js";

export interface CreateApiServerOptions {
  readonly projectQueryService?: ProjectQueryService;
  readonly providerQueryService?: ProviderQueryService;
  readonly policyQueryService?: PolicyQueryService;
  readonly runInsightsQueryService?: RunInsightsQueryService;
  readonly runComparisonQueryService?: RunComparisonQueryService;
  readonly reviewQueryService?: ReviewQueryService;
  readonly settingsQueryService?: SettingsQueryService;
  readonly runQueryService?: RunQueryService;
  readonly artifactQueryService?: ArtifactQueryService;
  readonly stagePlanQueryService?: StagePlanQueryService;
  readonly resolveProjectScopedServices?: (projectId: string) => Promise<ProjectScopedServices | null>;
  readonly resolveDefaultProjectId?: () => Promise<string | null>;
  readonly commandService?: AppCommandService;
  readonly cliCommandGateway?: CliCommandGateway;
  readonly onCliCommandEvent?: (event: CliCommandEvent) => void;
}

export interface ProjectScopedServices {
  readonly runQueryService: RunQueryService;
  readonly runInsightsQueryService?: RunInsightsQueryService;
  readonly runComparisonQueryService?: RunComparisonQueryService;
  readonly reviewQueryService?: ReviewQueryService;
  readonly artifactQueryService?: ArtifactQueryService;
  readonly stagePlanQueryService?: StagePlanQueryService;
  readonly providerQueryService?: ProviderQueryService;
  readonly policyQueryService?: PolicyQueryService;
  readonly settingsQueryService?: SettingsQueryService;
  readonly commandService?: AppCommandService;
  readonly cliCommandGateway?: CliCommandGateway;
}

type CliCommandEventStatus = "started" | "completed" | "failed";

export interface CliCommandEvent {
  readonly timestamp: string;
  readonly requestId?: string;
  readonly command: string;
  readonly status: CliCommandEventStatus;
  readonly exitCode?: number;
  readonly ok?: boolean;
  readonly error?: string;
  readonly runId?: string;
  readonly relatedRunIds?: readonly string[];
  readonly stageId?: string;
  readonly stagePlanArg?: string;
}

export function createApiServer(options: CreateApiServerOptions): FastifyInstance {
  const server = Fastify({ logger: false });
  const cliEventSubscribers = new Set<(event: CliCommandEvent) => void>();
  const cliEventHistory: CliCommandEvent[] = [];
  const cliEventHistoryLimit = 500;

  function publishCliCommandEvent(event: CliCommandEvent): void {
    cliEventHistory.push(event);
    if (cliEventHistory.length > cliEventHistoryLimit) {
      cliEventHistory.splice(0, cliEventHistory.length - cliEventHistoryLimit);
    }
    for (const send of cliEventSubscribers) {
      send(event);
    }
    options.onCliCommandEvent?.(event);
  }

  function parseProjectId(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  async function resolveScopedServices(projectId: string | undefined, reply: any): Promise<ProjectScopedServices | null> {
    const resolver = options.resolveProjectScopedServices;
    const targetProjectId = projectId ?? (options.resolveDefaultProjectId ? await options.resolveDefaultProjectId() : null) ?? undefined;
    if (resolver && targetProjectId) {
      const scoped = await resolver(targetProjectId);
      if (!scoped) {
        reply.code(404).send(
          errorResponseSchema.parse({
            code: "PROJECT_NOT_FOUND",
            message: "Project not found."
          })
        );
        return null;
      }
      return scoped;
    }

    if (!options.runQueryService) {
      reply.code(503).send(
        errorResponseSchema.parse({
          code: "RUN_QUERY_SERVICE_UNAVAILABLE",
          message: "Run query service is not configured."
        })
      );
      return null;
    }

    return {
      runQueryService: options.runQueryService,
      runInsightsQueryService: options.runInsightsQueryService,
      runComparisonQueryService: options.runComparisonQueryService,
      reviewQueryService: options.reviewQueryService,
      settingsQueryService: options.settingsQueryService,
      providerQueryService: options.providerQueryService,
      policyQueryService: options.policyQueryService,
      artifactQueryService: options.artifactQueryService,
      stagePlanQueryService: options.stagePlanQueryService,
      commandService: options.commandService,
      cliCommandGateway: options.cliCommandGateway
    } satisfies ProjectScopedServices;
  }

  server.get("/health", async () => {
    return healthResponseSchema.parse({ ok: true, service: "mergewright-api" });
  });

  server.get("/projects", async (_request, reply) => {
    const projectQueryService = options.projectQueryService;
    if (!projectQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
          message: "Project query service is not configured."
        })
      );
    }
    const projects = await projectQueryService.listProjects();
    return listProjectsResponseSchema.parse({ projects });
  });

  server.post("/projects", async (request, reply) => {
    const body = createProjectRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid project create request."
        })
      );
    }

    const projectQueryService = options.projectQueryService;
    if (!projectQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
          message: "Project query service is not configured."
        })
      );
    }

    try {
      const project = await projectQueryService.createProject(body.data.project);
      return createProjectResponseSchema.parse({ project });
    } catch (error) {
      return reply.code(409).send(
        errorResponseSchema.parse({
          code: "PROJECT_CONFLICT",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  });

  server.get("/providers", async (request, reply) => {
    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const providerQueryService = scoped.providerQueryService;
    if (!providerQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROVIDER_QUERY_SERVICE_UNAVAILABLE",
          message: "Provider query service is not configured."
        })
      );
    }

    const inventory = await providerQueryService.getProviderInventory();
    return getProvidersResponseSchema.parse({ inventory });
  });

  server.get("/policy", async (request, reply) => {
    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const policyQueryService = scoped.policyQueryService;
    if (!policyQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "POLICY_QUERY_SERVICE_UNAVAILABLE",
          message: "Policy query service is not configured."
        })
      );
    }

    const policy = await policyQueryService.getPolicySnapshot();
    return getPolicyResponseSchema.parse({ policy });
  });

  server.get("/safety/write-status", async (request, reply) => {
    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const policyQueryService = scoped.policyQueryService;
    if (!policyQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "POLICY_QUERY_SERVICE_UNAVAILABLE",
          message: "Policy query service is not configured."
        })
      );
    }

    const status = await policyQueryService.getWriteSafetyStatus();
    return getWriteSafetyStatusResponseSchema.parse({ status });
  });

  server.get("/settings", async (request, reply) => {
    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const settingsQueryService = scoped.settingsQueryService;
    if (!settingsQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "SETTINGS_QUERY_SERVICE_UNAVAILABLE",
          message: "Settings query service is not configured."
        })
      );
    }

    const settings = await settingsQueryService.getSettings();
    return getSettingsResponseSchema.parse({ settings });
  });

  server.put("/settings", async (request, reply) => {
    const body = updateSettingsRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid settings update request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const settingsQueryService = scoped.settingsQueryService;
    if (!settingsQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "SETTINGS_QUERY_SERVICE_UNAVAILABLE",
          message: "Settings query service is not configured."
        })
      );
    }

    const settings = await settingsQueryService.updateSettings(body.data.settings);
    return updateSettingsResponseSchema.parse({ settings });
  });

  server.get("/reviews", async (request, reply) => {
    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const reviewQueryService = scoped.reviewQueryService;
    if (!reviewQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "REVIEW_QUERY_SERVICE_UNAVAILABLE",
          message: "Review query service is not configured."
        })
      );
    }

    const reviews = await reviewQueryService.listReviews();
    return listReviewsResponseSchema.parse({ reviews });
  });

  server.post("/reviews/:reviewId/comments", async (request, reply) => {
    const params = reviewIdParamsSchema.safeParse(request.params);
    const body = addReviewCommentRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid review comment request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const reviewQueryService = scoped.reviewQueryService;
    if (!reviewQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "REVIEW_QUERY_SERVICE_UNAVAILABLE",
          message: "Review query service is not configured."
        })
      );
    }

    const review = await reviewQueryService.addComment(params.data.reviewId, body.data);
    if (!review) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "REVIEW_NOT_FOUND",
          message: "Review not found."
        })
      );
    }

    return addReviewCommentResponseSchema.parse({ review });
  });

  server.post("/reviews/:reviewId/approval", async (request, reply) => {
    const params = reviewIdParamsSchema.safeParse(request.params);
    const body = decideReviewRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid review approval request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const reviewQueryService = scoped.reviewQueryService;
    if (!reviewQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "REVIEW_QUERY_SERVICE_UNAVAILABLE",
          message: "Review query service is not configured."
        })
      );
    }

    const review = await reviewQueryService.decideReview(params.data.reviewId, body.data);
    if (!review) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "REVIEW_NOT_FOUND",
          message: "Review not found."
        })
      );
    }

    return decideReviewResponseSchema.parse({ review });
  });

  server.get("/projects/:projectId", async (request, reply) => {
    const params = getProjectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid project id."
        })
      );
    }

    const projectQueryService = options.projectQueryService;
    if (!projectQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
          message: "Project query service is not configured."
        })
      );
    }

    const project = await projectQueryService.getProject(params.data.projectId);
    if (!project) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "PROJECT_NOT_FOUND",
          message: "Project not found."
        })
      );
    }

    return getProjectResponseSchema.parse({ project });
  });

  server.put("/projects/:projectId", async (request, reply) => {
    const params = getProjectParamsSchema.safeParse(request.params);
    const body = updateProjectRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid project update request."
        })
      );
    }

    const projectQueryService = options.projectQueryService;
    if (!projectQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
          message: "Project query service is not configured."
        })
      );
    }

    try {
      const project = await projectQueryService.updateProject(params.data.projectId, body.data.project);
      if (!project) {
        return reply.code(404).send(
          errorResponseSchema.parse({
            code: "PROJECT_NOT_FOUND",
            message: "Project not found."
          })
        );
      }
      return updateProjectResponseSchema.parse({ project });
    } catch (error) {
      return reply.code(409).send(
        errorResponseSchema.parse({
          code: "PROJECT_CONFLICT",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
  });

  server.delete("/projects/:projectId", async (request, reply) => {
    const params = getProjectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid project id."
        })
      );
    }

    const projectQueryService = options.projectQueryService;
    if (!projectQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
          message: "Project query service is not configured."
        })
      );
    }

    const result = await projectQueryService.deleteProject(params.data.projectId);
    if (!result) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "PROJECT_NOT_FOUND",
          message: "Project not found."
        })
      );
    }
    if (!result.ok) {
      return reply.code(409).send(
        errorResponseSchema.parse({
          code: result.code,
          message: result.reason
        })
      );
    }
    return deleteProjectResponseSchema.parse({ ok: true });
  });

  server.get("/projects/:projectId/health", async (request, reply) => {
    const params = getProjectParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid project id."
        })
      );
    }

    const projectQueryService = options.projectQueryService;
    if (!projectQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "PROJECT_QUERY_SERVICE_UNAVAILABLE",
          message: "Project query service is not configured."
        })
      );
    }

    const health = await projectQueryService.getProjectHealth(params.data.projectId);
    if (!health) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "PROJECT_NOT_FOUND",
          message: "Project not found."
        })
      );
    }

    return getProjectHealthResponseSchema.parse({ health });
  });

  server.get("/runs", async (request, reply) => {
    const query = listRunsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run list query."
        })
      );
    }

    const scoped = await resolveScopedServices(query.data.projectId, reply);
    if (!scoped) {
      return;
    }
    const listRunsInput = query.data.status === undefined ? {} : { status: query.data.status };
    const runs = await scoped.runQueryService.listRuns(listRunsInput);
    return listRunsResponseSchema.parse({ runs });
  });

  server.get("/runs/compare", async (request, reply) => {
    const query = getRunComparisonQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run comparison request. Provide runA and runB query parameters."
        })
      );
    }

    const scoped = await resolveScopedServices(query.data.projectId, reply);
    if (!scoped) {
      return;
    }
    const runComparisonQueryService = scoped.runComparisonQueryService;
    if (!runComparisonQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "RUN_COMPARISON_QUERY_SERVICE_UNAVAILABLE",
          message: "Run comparison query service is not configured."
        })
      );
    }

    const comparison = await runComparisonQueryService.compareRuns({
      runIdA: query.data.runA,
      runIdB: query.data.runB
    });
    if (!comparison) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "RUN_COMPARISON_NOT_FOUND",
          message: "Could not compare runs. Ensure both run ids exist and are distinct."
        })
      );
    }

    return getRunComparisonResponseSchema.parse({ comparison });
  });

  server.get("/runs/:runId", async (request, reply) => {
    const params = getRunParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run id."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const run = await scoped.runQueryService.getRun({ runId: params.data.runId });
    if (!run) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "RUN_NOT_FOUND",
          message: "Run not found."
        })
      );
    }

    return getRunResponseSchema.parse({ run });
  });

  server.get("/runs/:runId/phase-artifacts", async (request, reply) => {
    const params = getRunParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run id."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const artifactQueryService = scoped.artifactQueryService;
    if (!artifactQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_QUERY_SERVICE_UNAVAILABLE",
          message: "Artifact query service is not configured."
        })
      );
    }

    const phaseArtifacts = await artifactQueryService.listPhaseArtifacts({ runId: params.data.runId });
    if (!phaseArtifacts) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "RUN_NOT_FOUND",
          message: "Run not found."
        })
      );
    }

    return getRunPhaseArtifactsResponseSchema.parse({ phaseArtifacts });
  });

  server.get("/runs/:runId/readiness", async (request, reply) => {
    const params = getRunParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run id."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const runInsightsQueryService = scoped.runInsightsQueryService;
    if (!runInsightsQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "RUN_INSIGHTS_QUERY_SERVICE_UNAVAILABLE",
          message: "Run insights query service is not configured."
        })
      );
    }

    const readiness = await runInsightsQueryService.getRunReadiness(params.data.runId);
    if (!readiness) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "RUN_NOT_FOUND",
          message: "Run not found."
        })
      );
    }

    return getRunReadinessResponseSchema.parse({ readiness });
  });

  server.get("/runs/:runId/review", async (request, reply) => {
    const params = getRunParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run id."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const runInsightsQueryService = scoped.runInsightsQueryService;
    if (!runInsightsQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "RUN_INSIGHTS_QUERY_SERVICE_UNAVAILABLE",
          message: "Run insights query service is not configured."
        })
      );
    }

    const review = await runInsightsQueryService.getRunReview(params.data.runId);
    if (!review) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "RUN_NOT_FOUND",
          message: "Run not found."
        })
      );
    }

    return getRunReviewResponseSchema.parse({ review });
  });

  server.get("/runs/:runId/evidence", async (request, reply) => {
    const params = getRunParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run id."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const runInsightsQueryService = scoped.runInsightsQueryService;
    if (!runInsightsQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "RUN_INSIGHTS_QUERY_SERVICE_UNAVAILABLE",
          message: "Run insights query service is not configured."
        })
      );
    }

    const evidence = await runInsightsQueryService.getRunEvidence(params.data.runId);
    if (!evidence) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "RUN_NOT_FOUND",
          message: "Run not found."
        })
      );
    }

    return getRunEvidenceResponseSchema.parse({ evidence });
  });

  server.get("/runs/:runId/artifacts", async (request, reply) => {
    const params = listRunArtifactsParamsSchema.safeParse(request.params);
    const query = listRunArtifactsQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid artifact list request."
        })
      );
    }

    const scoped = await resolveScopedServices(query.data.projectId, reply);
    if (!scoped) {
      return;
    }
    const artifactQueryService = scoped.artifactQueryService;
    if (!artifactQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_QUERY_SERVICE_UNAVAILABLE",
          message: "Artifact query service is not configured."
        })
      );
    }

    const listArtifactsInput =
      query.data.phaseId === undefined
        ? { runId: params.data.runId }
        : { runId: params.data.runId, phaseId: query.data.phaseId };
    const artifacts = await artifactQueryService.listArtifacts(listArtifactsInput);
    return listRunArtifactsResponseSchema.parse({ artifacts });
  });

  server.get("/runs/:runId/artifacts/:artifactId", async (request, reply) => {
    const params = getRunArtifactParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid artifact request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const artifactQueryService = scoped.artifactQueryService;
    if (!artifactQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_QUERY_SERVICE_UNAVAILABLE",
          message: "Artifact query service is not configured."
        })
      );
    }

    const artifact = await artifactQueryService.getArtifact({ runId: params.data.runId, artifactId: params.data.artifactId });
    if (!artifact) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_NOT_FOUND",
          message: "Artifact not found."
        })
      );
    }

    return getRunArtifactResponseSchema.parse({ artifact });
  });

  server.get("/runs/:runId/artifacts/:artifactId/content", async (request, reply) => {
    const params = getRunArtifactParamsSchema.safeParse(request.params);
    const query = getRunArtifactContentQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid artifact content request."
        })
      );
    }

    const scoped = await resolveScopedServices(query.data.projectId, reply);
    if (!scoped) {
      return;
    }
    const artifactQueryService = scoped.artifactQueryService;
    if (!artifactQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_QUERY_SERVICE_UNAVAILABLE",
          message: "Artifact query service is not configured."
        })
      );
    }

    let artifactContent;
    try {
      artifactContent = await artifactQueryService.getArtifactContent({
        runId: params.data.runId,
        artifactId: params.data.artifactId,
        maxBytes: query.data.maxBytes
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(422).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_CONTENT_FAILED",
          message
        })
      );
    }

    if (!artifactContent) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "ARTIFACT_NOT_FOUND",
          message: "Artifact content not found."
        })
      );
    }

    return getRunArtifactContentResponseSchema.parse(artifactContent);
  });

  server.get("/stage-plans", async (request, reply) => {
    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const stagePlanQueryService = scoped.stagePlanQueryService;
    if (!stagePlanQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "STAGE_PLAN_QUERY_SERVICE_UNAVAILABLE",
          message: "Stage plan query service is not configured."
        })
      );
    }

    const stagePlans = await stagePlanQueryService.listStagePlans();
    return listStagePlansResponseSchema.parse({ stagePlans });
  });

  server.get("/stage-plans/:stagePlanId", async (request, reply) => {
    const params = getStagePlanParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid stage plan id."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const stagePlanQueryService = scoped.stagePlanQueryService;
    if (!stagePlanQueryService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "STAGE_PLAN_QUERY_SERVICE_UNAVAILABLE",
          message: "Stage plan query service is not configured."
        })
      );
    }

    const stagePlan = await stagePlanQueryService.getStagePlan(params.data.stagePlanId);
    if (!stagePlan) {
      return reply.code(404).send(
        errorResponseSchema.parse({
          code: "STAGE_PLAN_NOT_FOUND",
          message: "Stage plan not found."
        })
      );
    }

    return getStagePlanResponseSchema.parse({ stagePlan });
  });

  server.post("/commands", async (request, reply) => {
    const body = submitCommandRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid command request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const commandService = scoped.commandService;
    if (!commandService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "COMMAND_SERVICE_UNAVAILABLE",
          message: "Command service is not configured."
        })
      );
    }

    const result = await commandService.execute(body.data.command as AppCommand, body.data.options ?? {});
    return submitCommandResponseSchema.parse({ result });
  });

  server.post("/commands/preview", async (request, reply) => {
    const body = previewCommandRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid command preview request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const commandService = scoped.commandService;
    if (!commandService) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "COMMAND_SERVICE_UNAVAILABLE",
          message: "Command service is not configured."
        })
      );
    }

    const description = await commandService.describe(body.data.command as AppCommand);
    return previewCommandResponseSchema.parse({ description });
  });

  server.post("/cli/commands", async (request, reply) => {
    const parsed = cliGatewayRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid CLI command request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const gateway = scoped.cliCommandGateway;
    if (!gateway) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "CLI_COMMAND_GATEWAY_UNAVAILABLE",
          message: "CLI command gateway is not configured."
        })
      );
    }

    const eventContext = toCliEventContext(parsed.data);

    publishCliCommandEvent({
      timestamp: new Date().toISOString(),
      requestId: parsed.data.requestId,
      command: parsed.data.command.command,
      status: "started",
      ...eventContext
    });

    const result = await gateway.execute(parsed.data);
    publishCliCommandEvent({
      timestamp: new Date().toISOString(),
      requestId: parsed.data.requestId,
      command: parsed.data.command.command,
      status: result.ok ? "completed" : "failed",
      exitCode: result.exitCode,
      ok: result.ok,
      error: result.error,
      ...eventContext
    });
    return reply.code(result.ok ? 200 : 422).send(result);
  });

  server.post("/cli/commands/preview", async (request, reply) => {
    const parsed = cliGatewayRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid CLI command preview request."
        })
      );
    }

    const projectId = parseProjectId((request.query as Record<string, unknown> | undefined)?.projectId);
    const scoped = await resolveScopedServices(projectId, reply);
    if (!scoped) {
      return;
    }
    const gateway = scoped.cliCommandGateway;
    if (!gateway) {
      return reply.code(503).send(
        errorResponseSchema.parse({
          code: "CLI_COMMAND_GATEWAY_UNAVAILABLE",
          message: "CLI command gateway is not configured."
        })
      );
    }

    const preview = await gateway.preview(parsed.data);
    return cliCommandPreviewResponseSchema.parse(preview);
  });

  server.get("/cli/events", async (_request, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });

    reply.raw.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), status: "connected" })}\n\n`);

    const send = (event: CliCommandEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    cliEventSubscribers.add(send);

    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
    }, 15000);

    reply.raw.on("close", () => {
      clearInterval(heartbeat);
      cliEventSubscribers.delete(send);
      reply.raw.end();
    });

    return reply;
  });

  server.get("/cli/events/recent", async (request, reply) => {
    const query = listCommandEventsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid recent event query. limit must be an integer between 1 and 500."
        })
      );
    }

    const parsedLimit = query.data.limit ?? 100;
    return reply.send({ events: cliEventHistory.slice(-parsedLimit) });
  });

  server.get("/commands/:commandId/events", async (request, reply) => {
    const params = getCommandEventsParamsSchema.safeParse(request.params);
    const query = listCommandEventsQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid command events request."
        })
      );
    }

    const limit = query.data.limit ?? 100;
    const events = cliEventHistory
      .filter((event) => event.requestId === params.data.commandId)
      .slice(-limit);

    return getCommandEventsResponseSchema.parse({ events });
  });

  server.get("/runs/:runId/events", async (request, reply) => {
    const params = getRunParamsSchema.safeParse(request.params);
    const query = listCommandEventsQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_FAILED",
          message: "Invalid run events request."
        })
      );
    }

    const limit = query.data.limit ?? 100;
    const events = cliEventHistory
      .filter((event) => event.runId === params.data.runId || event.relatedRunIds?.includes(params.data.runId))
      .slice(-limit);

    return getRunEventsResponseSchema.parse({ events });
  });

  return server;
}

function toCliEventContext(input: CliGatewayRequest): Pick<CliCommandEvent, "runId" | "relatedRunIds" | "stageId" | "stagePlanArg"> {
  const command = input.command;
  let runId: string | undefined;
  let relatedRunIds: readonly string[] | undefined;
  let stageId: string | undefined;
  let stagePlanArg: string | undefined;

  if ("runId" in command && typeof command.runId === "string" && command.runId.length > 0) {
    runId = command.runId;
  }

  if (command.command === "compare-runs") {
    runId = command.runIdA;
    relatedRunIds = [command.runIdA, command.runIdB];
  }

  if ("stageId" in command && typeof command.stageId === "string" && command.stageId.length > 0) {
    stageId = command.stageId;
  }

  if ("stagePlanArg" in command && typeof command.stagePlanArg === "string" && command.stagePlanArg.length > 0) {
    stagePlanArg = command.stagePlanArg;
  }

  return { runId, relatedRunIds, stageId, stagePlanArg };
}
