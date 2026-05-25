import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { RunQueryService } from "../application/queries/run-query-service.js";
import {
  errorResponseSchema,
  getRunParamsSchema,
  getRunResponseSchema,
  healthResponseSchema,
  listRunsQuerySchema,
  listRunsResponseSchema
} from "./run-api-schemas.js";

export interface CreateApiServerOptions {
  readonly runQueryService: RunQueryService;
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

    const runs = await options.runQueryService.listRuns({ status: query.data.status });
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

  return server;
}
