import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import type { OrchestratorConfig } from "../src/config/types.js";
import { StaticProjectQueryService } from "../src/application/queries/project-query-service.js";

async function createFixture(): Promise<{
  orchestratorRoot: string;
  configPath: string;
  runsRoot: string;
  config: OrchestratorConfig;
}> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "mw-project-query-"));
  const workspaceRoot = path.join(orchestratorRoot, "workspace");
  const runsRoot = path.join(orchestratorRoot, ".artifacts", "runs");
  const stagesRoot = path.join(orchestratorRoot, "stages");
  const promptsRoot = path.join(orchestratorRoot, "prompts");
  const configPath = path.join(orchestratorRoot, "config.example.json");

  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(runsRoot, { recursive: true });
  await mkdir(stagesRoot, { recursive: true });
  await mkdir(promptsRoot, { recursive: true });
  await writeFile(configPath, "{}\n", "utf8");

  const config: OrchestratorConfig = {
    version: 1,
    projectName: "MergeWright",
    workspaceRoot,
    paths: {
      stagesDir: "stages",
      promptsDir: "prompts",
      runsDir: ".artifacts/runs"
    },
    executionBackends: {
      "codex-local": { type: "codex-cli" },
      "opencode-local": { type: "opencode-cli", command: "opencode" }
    },
    agents: {
      planner: { backend: "codex-local", model: "gpt-5", reasoningEffort: "medium" },
      builder: { backend: "codex-local", model: "gpt-5", reasoningEffort: "medium" },
      reviewer: { backend: "codex-local", model: "gpt-5", reasoningEffort: "medium" }
    },
    pipeline: { finalReview: true, maxFixLoops: 2 },
    commands: { checks: [] },
    safety: {
      requireGitRepo: true,
      requireCleanStart: true,
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    },
    writeSafety: {
      enabled: true,
      allowedBranches: ["main"],
      blockedPaths: [],
      requireCleanWorkingTree: true,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: true,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  };

  return { orchestratorRoot, configPath, runsRoot, config };
}

test("StaticProjectQueryService exposes a single configured project and healthy status", async () => {
  const fixture = await createFixture();
  const service = new StaticProjectQueryService({
    projectId: "default",
    orchestratorRoot: fixture.orchestratorRoot,
    configPath: fixture.configPath,
    runsRoot: fixture.runsRoot,
    config: fixture.config
  });

  const projects = await service.listProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.id, "default");
  assert.equal(projects[0]?.defaultProvider, "codex-local");

  const detail = await service.getProject("default");
  assert.ok(detail);
  assert.equal(detail?.providers.length, 2);

  const health = await service.getProjectHealth("default");
  assert.ok(health);
  assert.equal(health?.healthy, true);
  assert.deepEqual(health?.warnings, []);
});

test("StaticProjectQueryService health reports missing path warnings", async () => {
  const fixture = await createFixture();
  const service = new StaticProjectQueryService({
    projectId: "default",
    orchestratorRoot: fixture.orchestratorRoot,
    configPath: path.join(fixture.orchestratorRoot, "missing-config.json"),
    runsRoot: path.join(fixture.orchestratorRoot, "missing-runs"),
    config: {
      ...fixture.config,
      workspaceRoot: path.join(fixture.orchestratorRoot, "missing-workspace"),
      paths: {
        ...fixture.config.paths,
        stagesDir: "missing-stages",
        promptsDir: "missing-prompts"
      }
    }
  });

  const health = await service.getProjectHealth("default");
  assert.ok(health);
  assert.equal(health?.healthy, false);
  assert.equal(health?.warnings.length, 5);
});
