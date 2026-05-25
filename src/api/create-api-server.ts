import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { ArtifactQueryService } from "../application/queries/artifact-query-service.js";
import type { RunQueryService } from "../application/queries/run-query-service.js";
import {
  errorResponseSchema,
  getRunArtifactParamsSchema,
  getRunArtifactResponseSchema,
  getRunParamsSchema,
  getRunResponseSchema,
  healthResponseSchema,
  listRunArtifactsParamsSchema,
  listRunArtifactsQuerySchema,
  listRunArtifactsResponseSchema,
  listRunsQuerySchema,
  listRunsResponseSchema
} from "./run-api-schemas.js";

export interface CreateApiServerOptions {
  readonly runQueryService: RunQueryService;
  readonly artifactQueryService?: ArtifactQueryService;
}

export function createApiServer(options: CreateApiServerOptions): FastifyInstance {
  const server = Fastify({ logger: false });

  server.get("/health", async () => {
    return healthResponseSchema.parse({ ok: true, service: "mergewright-api" });
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

    const listRunsInput = query.data.status === undefined ? {} : { status: query.data.status };
    const runs = await options.runQueryService.listRuns(listRunsInput);
    return listRunsResponseSchema.parse({ runs });
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

    const run = await options.runQueryService.getRun({ runId: params.data.runId });
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

    const artifactQueryService = options.artifactQueryService;
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

    const artifactQueryService = options.artifactQueryService;
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

  return server;
}
