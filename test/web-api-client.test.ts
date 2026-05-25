import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { RunDetail, RunSummary } from "../src/application/read-models/run-read-model.js";
import { MergeWrightApiClient, WebApiError, type WebApiFetch } from "../src/web/api-client.js";
import { toRunDetailViewModel, toRunListItemViewModel } from "../src/web/run-view-model.js";

const runSummary: RunSummary = {
  id: "run-1",
  title: "Run one",
  subtitle: "In progress",
  status: "running",
  branch: "feature/demo",
  mode: "read-only",
  warnings: ["Check reviewer notes"]
};

const runDetail: RunDetail = {
  id: "run-1",
  title: "Run one",
  status: "blocked",
  runDir: "/tmp/run-1",
  branch: undefined,
  mode: "auto-chain",
  phases: [
    {
      id: "planner",
      label: "Planner",
      status: "passed",
      summary: "Plan complete",
      durationMs: 1450,
      artefactIds: ["plan"]
    },
    {
      id: "builder",
      label: "Builder",
      status: "blocked",
      artefactIds: [],
      blockedReason: "Needs confirmation"
    }
  ],
  artefacts: [
    {
      id: "plan",
      title: "Plan",
      kind: "markdown",
      path: "plan.md",
      phaseId: "planner"
    }
  ],
  safeActions: [
    {
      id: "continue",
      label: "Continue",
      enabled: true,
      risk: "low",
      requiresConfirmation: false
    },
    {
      id: "request-fix",
      label: "Request fix",
      enabled: false,
      blockedReason: "Needs confirmation",
      risk: "high",
      requiresConfirmation: true
    }
  ],
  blockedReason: "Needs confirmation",
  reviewerFindings: [
    {
      severity: "medium",
      message: "Missing tests"
    }
  ],
  warnings: []
};

function createFetch(payloads: Record<string, unknown>, calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }>): WebApiFetch {
  return async (url, init) => {
    calls.push({ url, init });
    const payload = payloads[url];
    return {
      ok: payload !== undefined,
      status: payload === undefined ? 404 : 200,
      async json() {
        return payload ?? { code: "NOT_FOUND", message: "Missing" };
      }
    };
  };
}

test("MergeWrightApiClient lists runs with optional status filter", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000/",
    fetch: createFetch({ "http://localhost:3000/runs?status=running": { runs: [runSummary] } }, calls)
  });

  const runs = await client.listRuns("running");

  assert.deepEqual(runs, [runSummary]);
  assert.deepEqual(calls, [{ url: "http://localhost:3000/runs?status=running", init: undefined }]);
});

test("MergeWrightApiClient fetches run detail and artifact metadata", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch(
      {
        "http://localhost:3000/runs/run-1": { run: runDetail },
        "http://localhost:3000/runs/run-1/artifacts?phaseId=planner": { artifacts: [runDetail.artefacts[0]] },
        "http://localhost:3000/runs/run-1/artifacts/plan": { artifact: runDetail.artefacts[0] }
      },
      calls
    )
  });

  assert.deepEqual(await client.getRun("run-1"), runDetail);
  assert.deepEqual(await client.listRunArtifacts("run-1", "planner"), [runDetail.artefacts[0]]);
  assert.deepEqual(await client.getRunArtifact("run-1", "plan"), runDetail.artefacts[0]);
});

test("MergeWrightApiClient submits commands through the API", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const command: AppCommand = {
    commandId: "cmd-1",
    source: "automation",
    requestedAt: "2026-05-25T00:00:00.000Z",
    type: "select-task",
    taskId: "task-1"
  };
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch(
      {
        "http://localhost:3000/commands": {
          result: { ok: true, commandId: "cmd-1", type: "select-task", message: "Accepted" }
        }
      },
      calls
    )
  });

  const result = await client.submitCommand(command, { confirmationContextId: "ctx-1" });

  assert.deepEqual(result, { ok: true, commandId: "cmd-1", type: "select-task", message: "Accepted" });
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.headers?.["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0]?.init?.body ?? "{}"), { command, options: { confirmationContextId: "ctx-1" } });
});

test("MergeWrightApiClient throws structured API errors", async () => {
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch({}, [])
  });

  await assert.rejects(() => client.getRun("missing"), (error) => {
    assert.ok(error instanceof WebApiError);
    assert.equal(error.status, 404);
    assert.deepEqual(error.payload, { code: "NOT_FOUND", message: "Missing" });
    return true;
  });
});

test("run view models prepare API data for the web shell", () => {
  assert.deepEqual(toRunListItemViewModel(runSummary), {
    id: "run-1",
    title: "Run one",
    subtitle: "In progress",
    status: "running",
    branchLabel: "feature/demo",
    modeLabel: "Read Only",
    warningCount: 1
  });

  assert.deepEqual(toRunDetailViewModel(runDetail), {
    id: "run-1",
    title: "Run one",
    status: "blocked",
    branchLabel: "No branch",
    modeLabel: "Auto Chain",
    phaseCount: 2,
    artifactCount: 1,
    reviewerFindingCount: 1,
    safeActionCount: 1,
    blockedReason: "Needs confirmation",
    phases: [
      {
        id: "planner",
        label: "Planner",
        status: "passed",
        summary: "Plan complete",
        artifactCount: 1,
        durationLabel: "1s",
        blockedReason: undefined
      },
      {
        id: "builder",
        label: "Builder",
        status: "blocked",
        summary: "No summary available",
        artifactCount: 0,
        durationLabel: "Not recorded",
        blockedReason: "Needs confirmation"
      }
    ]
  });
});
