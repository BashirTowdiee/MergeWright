import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { FilesystemStagePlanQueryService } from "../src/application/queries/stage-plan-query-service.js";

async function createStagePlanFixture(): Promise<{ orchestratorRoot: string; expectedId: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "mw-stage-plan-query-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts", "runs", "provider-switching");
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await mkdir(stagePlanDir, { recursive: true });

  await writeFile(
    stagePlanPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "provider-switching",
        title: "Provider switching",
        goal: "Introduce provider switching with explicit gates.",
        source: "imported",
        status: "running",
        createdAt: "2026-05-31T00:00:00.000Z",
        updatedAt: "2026-05-31T01:00:00.000Z",
        stages: [
          {
            id: "stage-00-foundation",
            index: 1,
            title: "Foundation",
            goal: "Prepare abstractions.",
            status: "accepted",
            dependsOn: [],
            assumptions: [],
            scope: { include: ["src/providers/**"], exclude: [] },
            acceptanceCriteria: ["Compiles with adapter boundary."],
            checks: ["npm run build"],
            expectedOutputs: ["stage-report.md"],
            revision: 1
          },
          {
            id: "stage-01-provider-contract",
            index: 2,
            title: "Provider contract",
            goal: "Introduce provider contract.",
            status: "review_required",
            dependsOn: ["stage-00-foundation"],
            assumptions: [],
            scope: { include: ["src/providers/**"], exclude: [] },
            acceptanceCriteria: ["Contract enforces typed outputs."],
            checks: ["npm test"],
            expectedOutputs: ["stage-report.md"],
            revision: 2
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const relativePath = ".artifacts/runs/provider-switching/stage-plan.json";
  const expectedId = Buffer.from(relativePath, "utf8").toString("base64url");
  return { orchestratorRoot, expectedId };
}

test("FilesystemStagePlanQueryService lists discovered stage plans", async () => {
  const fixture = await createStagePlanFixture();
  const service = new FilesystemStagePlanQueryService({
    orchestratorRoot: fixture.orchestratorRoot,
    candidateRoots: [".artifacts"]
  });

  const plans = await service.listStagePlans();
  assert.equal(plans.length, 1);
  assert.equal(plans[0]?.id, fixture.expectedId);
  assert.equal(plans[0]?.planId, "provider-switching");
  assert.equal(plans[0]?.stageCount, 2);
});

test("FilesystemStagePlanQueryService returns detailed stage-plan view by id", async () => {
  const fixture = await createStagePlanFixture();
  const service = new FilesystemStagePlanQueryService({
    orchestratorRoot: fixture.orchestratorRoot,
    candidateRoots: [".artifacts"]
  });

  const detail = await service.getStagePlan(fixture.expectedId);
  assert.ok(detail);
  assert.equal(detail?.planId, "provider-switching");
  assert.equal(detail?.statusCounts.accepted, 1);
  assert.equal(detail?.statusCounts.reviewRequired, 1);
  assert.equal(detail?.stages[1]?.id, "stage-01-provider-contract");
  assert.deepEqual(detail?.stages[1]?.dependsOn, ["stage-00-foundation"]);
});
