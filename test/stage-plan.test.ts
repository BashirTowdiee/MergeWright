import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StagePlan } from "../src/stage-plan.js";
import { parseStagePlanJson, serialiseStagePlan, validateStagePlan } from "../src/stage-plan-schema.js";
import { readStagePlan, writeStagePlan } from "../src/stage-plan-store.js";

function buildValidPlan(): StagePlan {
  return {
    schemaVersion: 1,
    id: "plan-1",
    title: "Plan title",
    goal: "Plan goal",
    source: "manual",
    status: "draft",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    stages: [
      {
        id: "stage-1",
        index: 1,
        title: "Stage 1",
        goal: "First goal",
        status: "pending",
        dependsOn: [],
        assumptions: [],
        scope: { include: ["src"], exclude: ["dist"] },
        acceptanceCriteria: ["criterion 1"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      },
      {
        id: "stage-2",
        index: 2,
        title: "Stage 2",
        goal: "Second goal",
        status: "pending",
        dependsOn: ["stage-1"],
        assumptions: ["assumption"],
        scope: { include: [], exclude: [] },
        acceptanceCriteria: ["criterion 2"],
        checks: ["npm test"],
        expectedOutputs: ["output.md"],
        revision: 1
      }
    ]
  };
}

test("valid stage plan parses successfully", () => {
  const json = JSON.stringify(buildValidPlan());
  const parsed = parseStagePlanJson(json);
  assert.equal(parsed.id, "plan-1");
  assert.equal(parsed.stages.length, 2);
});

test("stage plan serialises deterministically", () => {
  const plan = buildValidPlan();
  const first = serialiseStagePlan(plan);
  const second = serialiseStagePlan(validateStagePlan(JSON.parse(first) as unknown));
  assert.equal(first, second);
});

test("writeStagePlan then readStagePlan round-trips successfully", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "stage-plan-"));
  const filePath = path.join(tmpDir, "nested", "plan.json");
  const plan = buildValidPlan();
  await writeStagePlan(filePath, plan);

  const disk = await readFile(filePath, "utf8");
  assert.equal(disk, serialiseStagePlan(plan));

  const loaded = await readStagePlan(filePath);
  assert.deepEqual(loaded, plan);
});

test("duplicate stage ids fail validation", () => {
  const plan = buildValidPlan();
  plan.stages[1].id = plan.stages[0].id;
  assert.throws(() => validateStagePlan(plan), /duplicate stage id/);
});

test("missing dependency target fails validation", () => {
  const plan = buildValidPlan();
  plan.stages[1].dependsOn = ["missing"];
  assert.throws(() => validateStagePlan(plan), /depends on missing stage/);
});

test("self dependency fails validation", () => {
  const plan = buildValidPlan();
  plan.stages[1].dependsOn = ["stage-2"];
  assert.throws(() => validateStagePlan(plan), /must not depend on itself/);
});

test("dependency on future stage fails validation", () => {
  const plan = buildValidPlan();
  plan.stages[0].dependsOn = ["stage-2"];
  assert.throws(() => validateStagePlan(plan), /non-linear dependency/);
});

test("empty acceptanceCriteria fails validation", () => {
  const plan = buildValidPlan();
  plan.stages[0].acceptanceCriteria = [];
  assert.throws(() => validateStagePlan(plan), /acceptanceCriteria must contain at least one item/);
});

test("invalid revision fails validation", () => {
  const plan = buildValidPlan();
  plan.stages[0].revision = 0;
  assert.throws(() => validateStagePlan(plan), /revision must be a positive integer/);
});

test("optional commitSha is accepted when non-empty", () => {
  const plan = buildValidPlan();
  plan.stages[1].commitSha = "abc123";
  assert.doesNotThrow(() => validateStagePlan(plan));
});

test("empty commitSha fails validation", () => {
  const plan = buildValidPlan();
  plan.stages[1].commitSha = "";
  assert.throws(() => validateStagePlan(plan), /commitSha must be a non-empty string/);
});

test("docs stage plan example fixture validates", async () => {
  const fixturePath = path.join(process.cwd(), "docs", "examples", "stage-plan.example.json");
  const plan = await readStagePlan(fixturePath);

  assert.equal(plan.id, "provider-switching-example");
  assert.equal(plan.stages.length, 3);
  assert.deepEqual(plan.stages.map((stage) => stage.id), [
    "stage-01-provider-contract",
    "stage-02-openrouter-adapter",
    "stage-03-docs-and-safety"
  ]);
});
