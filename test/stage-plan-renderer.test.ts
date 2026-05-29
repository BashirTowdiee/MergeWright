import assert from "node:assert/strict";
import test from "node:test";
import type { StagePlan } from "../src/stage-plan.js";
import { renderStagePlanMarkdown } from "../src/stage-plan-renderer.js";

function buildPlan(): StagePlan {
  return {
    schemaVersion: 1,
    id: "provider-switching",
    title: "Provider Switching",
    goal: "Move from provider A to provider B",
    source: "imported",
    status: "ready",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T01:00:00.000Z",
    stages: [
      {
        id: "stage-1",
        index: 1,
        title: "Audit usage",
        goal: "Find provider touch points",
        status: "pending",
        dependsOn: [],
        assumptions: ["API keys are available"],
        scope: { include: ["src/providers"], exclude: ["dist"] },
        acceptanceCriteria: ["All touch points listed"],
        checks: ["npm test"],
        expectedOutputs: ["docs/audit.md"],
        contract: {
          allowedPaths: ["src/providers/**"],
          forbiddenPaths: ["package-lock.json"],
          requiredCommands: ["npm test"],
          requiredEvidence: ["git.diff", "checks.unit"],
          review: {
            checklist: ["verify command examples"]
          }
        },
        revision: 1
      },
      {
        id: "stage-2",
        index: 2,
        title: "Switch adapter",
        goal: "Wire provider B",
        status: "pending",
        dependsOn: ["stage-1"],
        assumptions: [],
        scope: { include: ["src/adapters"], exclude: [] },
        acceptanceCriteria: ["Adapter compiles"],
        checks: [],
        expectedOutputs: [],
        revision: 2,
        commitSha: "abc123"
      }
    ]
  };
}

test("renders title and goal", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /^# Provider Switching/m);
  assert.match(markdown, /- goal: Move from provider A to provider B/);
});

test("renders stage summary table", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /\| index \| id \| title \| status \| revision \| dependsOn \|/);
  assert.match(markdown, /\| 1 \| stage-1 \| Audit usage \| pending \| 1 \| - \|/);
  assert.match(markdown, /\| 2 \| stage-2 \| Switch adapter \| pending \| 2 \| stage-1 \|/);
});

test("renders assumptions", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /### Assumptions/);
  assert.match(markdown, /- API keys are available/);
});

test("renders acceptance criteria", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /### Acceptance Criteria/);
  assert.match(markdown, /- Adapter compiles/);
});

test("renders checks", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /### Checks/);
  assert.match(markdown, /- npm test/);
});

test("renders scope include and exclude", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /### Scope Include/);
  assert.match(markdown, /- src\/providers/);
  assert.match(markdown, /### Scope Exclude/);
  assert.match(markdown, /- dist/);
});

test("renders contract summary when present", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /### Contract/);
  assert.match(markdown, /- allowedPaths:/);
  assert.match(markdown, /  - src\/providers\/\*\*/);
  assert.match(markdown, /- forbiddenPaths:/);
  assert.match(markdown, /  - package-lock.json/);
  assert.match(markdown, /- requiredCommands:/);
  assert.match(markdown, /  - npm test/);
  assert.match(markdown, /- requiredEvidence:/);
  assert.match(markdown, /  - checks.unit/);
  assert.match(markdown, /- review.checklist:/);
  assert.match(markdown, /  - verify command examples/);
});

test("renders commitSha when present", () => {
  const markdown = renderStagePlanMarkdown(buildPlan());
  assert.match(markdown, /- commitSha: abc123/);
});

test("output is deterministic for same input", () => {
  const plan = buildPlan();
  const first = renderStagePlanMarkdown(plan);
  const second = renderStagePlanMarkdown(plan);
  assert.equal(first, second);
});
