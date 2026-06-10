import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { createMergeWrightMcpTools } from "../src/mcp/server.js";
import type { OrchestratorConfig } from "../src/config/types.js";

test("MCP execute_audited_flow runs the default deterministic audited flow", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-audited-flow-root-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "mcp-audited-flow-workspace-"));
  const tools = createMergeWrightMcpTools({
    cwd: () => orchestratorRoot
  });

  const result = await tools.executeAuditedFlow({
    goal: "Implement MCP slice",
    workspace
  });

  assert.equal(result.status, "passed");
  assert.equal(result.dryRun, true);
  assert.equal(result.contract.flow, "feature-standard");
  assert.deepEqual(
    result.stageResults.map((stage) => [stage.stageId, stage.executor]),
    [
      ["plan", "deterministic-dry-run"],
      ["build", "deterministic-dry-run"],
      ["check", "deterministic-dry-run"],
      ["review", "deterministic-dry-run"],
      ["final-review", "deterministic-dry-run"]
    ]
  );
  assert.equal(result.contract.workspace, workspace);
});

test("MCP shell-check stages require project or config context and only apply to check stages", async () => {
  const fixture = await createProjectFixture();

  await assert.rejects(
    () =>
      fixture.tools.executeAuditedFlow({
        goal: "Run checks",
        workspace: fixture.workspaceRoot,
        stages: [{ id: "checks", kind: "check", executor: "shell-check" }]
      }),
    /shell-check stages require either projectId or configPath/
  );

  await assert.rejects(
    () =>
      fixture.tools.executeAuditedFlow({
        goal: "Run checks",
        workspace: fixture.workspaceRoot,
        projectId: fixture.projectId,
        stages: [{ id: "build", kind: "build", executor: "shell-check" }]
      }),
    /shell-check is only supported for check stages/
  );
});

test("MCP project and policy tools expose project-scoped MergeWright state", async () => {
  const fixture = await createProjectFixture();

  const projects = await fixture.tools.listProjects();
  assert.equal(projects.orchestratorRoot, fixture.orchestratorRoot);
  assert.deepEqual(projects.projects.map((project) => project.id), [fixture.projectId]);

  const settings = await fixture.tools.getSettings();
  assert.equal(settings.settings.project.activeProjectId, fixture.projectId);
  assert.equal(settings.settings.project.defaultConfigPath, fixture.configRelativePath);

  const project = await fixture.tools.getProject({ projectId: fixture.projectId });
  assert.equal(project.project.id, fixture.projectId);
  assert.equal(project.project.workspaceRoot, fixture.workspaceRoot);
  assert.deepEqual(project.project.providers, ["codex"]);

  const providers = await fixture.tools.getProviderInventory({ projectId: fixture.projectId });
  assert.equal(providers.projectId, fixture.projectId);
  assert.equal(providers.providerInventory.defaultProvider, "codex");
  assert.deepEqual(providers.providerInventory.providers.map((provider) => provider.id), ["codex"]);

  const policy = await fixture.tools.getPolicySnapshot({ projectId: fixture.projectId });
  assert.equal(policy.projectId, fixture.projectId);
  assert.equal(policy.policy.checkCount, 1);
  assert.equal(policy.policy.writeSafetyEnabled, false);

  const writeSafety = await fixture.tools.getWriteSafetyStatus({ projectId: fixture.projectId });
  assert.equal(writeSafety.projectId, fixture.projectId);
  assert.equal(writeSafety.writeSafetyStatus.enabled, false);
  assert.equal(writeSafety.writeSafetyStatus.ok, false);
  assert.match(writeSafety.writeSafetyStatus.summary, /Write safety check failed/);
});

test("MCP shell-check execution, run queries, and CLI gateway tools work from project context", async () => {
  const fixture = await createProjectFixture();

  const created = await fixture.tools.executeAuditedFlow({
    goal: "Run configured shell checks through MCP",
    workspace: fixture.workspaceRoot,
    projectId: fixture.projectId,
    dryRun: false,
    requiredChecks: ["unit"],
    stages: [{ id: "checks", kind: "check", executor: "shell-check" }]
  });

  assert.equal(created.status, "passed");
  assert.equal(created.dryRun, false);
  assert.deepEqual(
    created.stageResults.map((stage) => [stage.stageId, stage.executor, stage.status]),
    [["checks", "shell-check", "passed"]]
  );

  const run = await fixture.tools.getAuditedFlowRun({
    runId: created.runId,
    projectId: fixture.projectId
  });
  assert.equal(run.contract.goal, "Run configured shell checks through MCP");
  assert.deepEqual(run.contract.requiredChecks, ["unit"]);

  const runEvents = await fixture.tools.getAuditedFlowEvents({
    runId: created.runId,
    projectId: fixture.projectId
  });
  assert.ok(runEvents.events.some((event) => event.type === "command.started"));
  assert.ok(runEvents.events.some((event) => event.type === "command.completed"));

  const listedRuns = await fixture.tools.listRuns({
    projectId: fixture.projectId,
    status: "all"
  });
  assert.ok(listedRuns.runs.some((entry) => entry.id === created.runId));

  const runDetail = await fixture.tools.getRunDetail({
    projectId: fixture.projectId,
    runId: created.runId
  });
  assert.equal(runDetail.projectId, fixture.projectId);
  assert.equal(runDetail.run.id, created.runId);
  assert.equal(runDetail.run.readiness?.checksState, "passed");

  const preview = await fixture.tools.previewCliCommand({
    projectId: fixture.projectId,
    request: {
      requestId: "preview-1",
      command: {
        command: "check-write-safety"
      }
    }
  });
  assert.equal(preview.projectId, fixture.projectId);
  assert.equal(preview.preview.command, "check-write-safety");
  assert.match(preview.preview.equivalentCli, /check-write-safety --config/);
  assert.equal(preview.preview.requiresConfirmation, false);

  const executed = await fixture.tools.executeCliCommand({
    projectId: fixture.projectId,
    request: {
      requestId: "exec-1",
      command: {
        command: "check-write-safety"
      }
    }
  });
  assert.equal(executed.projectId, fixture.projectId);
  assert.equal(executed.result.command, "check-write-safety");
  assert.equal(executed.result.ok, false);
  assert.equal(executed.result.exitCode, 1);
  assert.equal(executed.result.error, "check-write-safety failed");
});

test("MCP audited-flow inspection fails clearly for a missing run", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-audited-flow-missing-root-"));
  const tools = createMergeWrightMcpTools({
    cwd: () => orchestratorRoot
  });

  await assert.rejects(() => tools.getAuditedFlowRun({ runId: "missing-run" }), /Audited flow contract not found for run missing-run/);
});

async function createProjectFixture(): Promise<{
  orchestratorRoot: string;
  workspaceRoot: string;
  projectId: string;
  configRelativePath: string;
  tools: ReturnType<typeof createMergeWrightMcpTools>;
}> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-project-root-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-project-workspace-"));
  const projectId = "default";
  const configRelativePath = `.artifacts/projects/${projectId}/config.json`;
  const configPath = path.resolve(orchestratorRoot, configRelativePath);
  const runsRoot = path.resolve(orchestratorRoot, ".artifacts", "runs", projectId);

  await mkdir(path.dirname(configPath), { recursive: true });
  await mkdir(path.resolve(orchestratorRoot, ".artifacts"), { recursive: true });
  await mkdir(path.resolve(orchestratorRoot, "stages", projectId), { recursive: true });
  await mkdir(path.resolve(orchestratorRoot, "prompts"), { recursive: true });
  await mkdir(runsRoot, { recursive: true });

  await writeJson(configPath, makeConfig(workspaceRoot));
  await writeJson(path.resolve(orchestratorRoot, ".artifacts", "projects.json"), {
    version: 1,
    projects: [
      {
        id: projectId,
        name: "Default Project",
        configPath: configRelativePath
      }
    ]
  });
  await writeJson(path.resolve(orchestratorRoot, ".artifacts", "web-settings.json"), {
    version: 1,
    project: {
      activeProjectId: projectId,
      defaultConfigPath: configRelativePath,
      runsRoot,
      defaultProvider: "codex",
      defaultModel: "gpt-5.3-codex",
      defaultMode: "preview-first"
    },
    retention: {
      evidenceDays: 30,
      artifactDays: 30
    },
    ui: {
      theme: "system",
      keyboardShortcuts: true
    },
    updatedAt: "2026-06-11T00:00:00.000Z"
  });

  return {
    orchestratorRoot,
    workspaceRoot,
    projectId,
    configRelativePath,
    tools: createMergeWrightMcpTools({
      cwd: () => orchestratorRoot
    })
  };
}

function makeConfig(workspaceRoot: string): OrchestratorConfig {
  return {
    version: 1,
    projectName: "Default Project",
    workspaceRoot,
    paths: {
      stagesDir: "stages/default",
      promptsDir: "prompts",
      runsDir: ".artifacts/runs/default"
    },
    executionBackends: {
      codex: {
        type: "codex-cli"
      }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" },
      builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" }
    },
    pipeline: {
      finalReview: true,
      maxFixLoops: 1
    },
    commands: {
      checks: [
        {
          name: "unit",
          command: process.execPath,
          args: ["-e", 'console.log("unit ok")'],
          cwd: "workspace"
        }
      ]
    },
    safety: {
      requireGitRepo: false,
      requireCleanStart: false,
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    },
    writeSafety: {
      enabled: false,
      allowedBranches: [],
      blockedPaths: [],
      requireCleanWorkingTree: false,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: true,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
