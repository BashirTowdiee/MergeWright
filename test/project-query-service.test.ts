import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import type { OrchestratorConfig } from "../src/config/types.js";
import { FileProjectCatalogQueryService } from "../src/application/queries/project-query-service.js";

async function createFixture(): Promise<{
  orchestratorRoot: string;
  configPath: string;
  runsRoot: string;
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
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return { orchestratorRoot, configPath, runsRoot };
}

test("FileProjectCatalogQueryService exposes seeded default project and health", async () => {
  const fixture = await createFixture();
  const service = new FileProjectCatalogQueryService({
    orchestratorRoot: fixture.orchestratorRoot,
    catalogPath: path.join(fixture.orchestratorRoot, ".artifacts", "projects.json"),
    initialProject: {
      id: "default",
      name: "MergeWright",
      configPath: fixture.configPath
    }
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

test("FileProjectCatalogQueryService supports create, update, and delete guard", async () => {
  const fixture = await createFixture();
  const service = new FileProjectCatalogQueryService({
    orchestratorRoot: fixture.orchestratorRoot,
    catalogPath: path.join(fixture.orchestratorRoot, ".artifacts", "projects.json"),
    initialProject: {
      id: "default",
      name: "MergeWright",
      configPath: fixture.configPath
    }
  });

  const created = await service.createProject({
    name: "MergeWright",
    configPath: fixture.configPath
  });
  assert.equal(created.id, "mergewright");

  const updated = await service.updateProject(created.id, { name: "MergeWright Updated" });
  assert.equal(updated?.name, "MergeWright Updated");

  await mkdir(path.join(fixture.runsRoot, "run-1"), { recursive: true });
  const blocked = await service.deleteProject("default");
  assert.equal(blocked?.ok, false);
  if (blocked?.ok === false) {
    assert.equal(blocked.code, "PROJECT_NOT_EMPTY");
  }
});

test("FileProjectCatalogQueryService updates project config defaults", async () => {
  const fixture = await createFixture();
  const service = new FileProjectCatalogQueryService({
    orchestratorRoot: fixture.orchestratorRoot,
    catalogPath: path.join(fixture.orchestratorRoot, ".artifacts", "projects.json"),
    initialProject: {
      id: "default",
      name: "MergeWright",
      configPath: fixture.configPath
    }
  });

  const updated = await service.updateProjectConfig("default", {
    runsDir: ".artifacts/runs/default",
    defaultProvider: "opencode-local",
    defaultModel: "gpt-5.3-codex"
  });
  assert.ok(updated);
  assert.equal(updated?.defaultProvider, "opencode-local");
  assert.equal(updated?.runsRoot, path.join(fixture.orchestratorRoot, ".artifacts", "runs", "default"));

  const persisted = JSON.parse(await readFile(fixture.configPath, "utf8")) as OrchestratorConfig;
  assert.equal(persisted.paths.runsDir, ".artifacts/runs/default");
  assert.equal(persisted.agents.planner.backend, "opencode-local");
  assert.equal(persisted.agents.builder.backend, "opencode-local");
  assert.equal(persisted.agents.reviewer.backend, "opencode-local");
  assert.equal(persisted.agents.planner.model, "gpt-5.3-codex");
  assert.equal(persisted.agents.builder.model, "gpt-5.3-codex");
  assert.equal(persisted.agents.reviewer.model, "gpt-5.3-codex");
});
