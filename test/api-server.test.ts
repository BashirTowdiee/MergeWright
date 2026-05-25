import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../src/api/create-api-server.js";
import type { RunDetail, RunSummary, RunArtefact } from "../src/application/read-models/run-read-model.js";
import type { ArtifactQueryService, GetArtifactInput, ListArtifactsInput } from "../src/application/queries/artifact-query-service.js";
import type { RunQueryService, ListRunsInput, GetRunInput } from "../src/application/queries/run-query-service.js";

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

  async getArtifact(input: GetArtifactInput): Promise<RunArtefact | null> {
    this.getCalls.push(input);
    if (input.runId !== runDetail.id) {
      return null;
    }
    return this.artifacts.find((artifact) => artifact.id === input.artifactId) ?? null;
  }
}

test("GET /health returns API status", async () => {
  const server = createApiServer({ runQueryService: new FakeRunQueryService() });
  const response = await server.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "mergewright-api" });
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
