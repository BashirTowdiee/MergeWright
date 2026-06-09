import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import type { RunContract } from "../src/application/audited-flow/contract.js";
import { ShellCheckStageExecutor } from "../src/application/audited-flow/shell-check-stage-executor.js";
import { validateRunContract } from "../src/application/audited-flow/contract-validation.js";
import { StageExecutorRegistry } from "../src/application/audited-flow/executor-registry.js";
import { type StageExecutor, type StageResult } from "../src/application/audited-flow/stage-executor.js";
import { FilesystemAuditedFlowAuditWriter } from "../src/application/audited-flow/audit-writer.js";
import { executeAuditedFlow } from "../src/application/use-cases/execute-audited-flow-use-case.js";
import type { OrchestratorConfig } from "../src/config/types.js";

test("contract validation rejects missing goal workspace and stages", () => {
  const errors = validateRunContract({
    goal: "",
    workspace: "",
    flow: "feature-standard",
    stages: []
  });

  assert.deepEqual(errors, [
    "Run contract goal is required.",
    "Run contract workspace is required.",
    "Run contract must define at least one stage."
  ]);
});

test("executor registry rejects unknown executors", () => {
  const registry = new StageExecutorRegistry([]);
  assert.throws(() => registry.resolve("missing"), /Unknown stage executor: missing/);
});

test("executeAuditedFlow runs stages in order and writes append-only ndjson audit", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-order-"));
  const seen: string[] = [];
  const registry = new StageExecutorRegistry([
    makeExecutor({
      run(stage) {
        seen.push(stage.stage.id);
        return {
          stageId: stage.stage.id,
          kind: stage.stage.kind,
          executor: "ordered",
          status: "passed",
          summary: `passed ${stage.stage.id}`
        };
      }
    })
  ]);

  const result = await executeAuditedFlow({
    contract: {
      goal: "Add feature",
      workspace: "/tmp/workspace",
      flow: "feature-standard",
      stages: [
        { id: "plan", kind: "plan", executor: "ordered" },
        { id: "build", kind: "build", executor: "ordered" },
        { id: "review", kind: "review", executor: "ordered" }
      ]
    },
    orchestratorRoot,
    executorRegistry: registry,
    runIdFactory: () => "run-order"
  });

  assert.deepEqual(seen, ["plan", "build", "review"]);
  assert.equal(result.status, "passed");
  assert.deepEqual(result.stageResults.map((stage) => stage.stageId), ["plan", "build", "review"]);

  const auditLines = (await readFile(result.auditPath, "utf8")).trim().split("\n");
  assert.ok(auditLines.length > 0);
  const events = auditLines.map((line) => JSON.parse(line) as { type: string; stageId?: string; executorId?: string });
  assert.equal(events[0]?.type, "run.created");
  assert.ok(events.some((event) => event.type === "flow.selected"));
  assert.ok(events.some((event) => event.type === "stage.started" && event.stageId === "plan"));
  assert.ok(events.some((event) => event.type === "prompt.generated" && event.stageId === "plan"));
  assert.ok(events.some((event) => event.type === "executor.invoked" && event.executorId === "ordered"));
  assert.ok(events.some((event) => event.type === "executor.completed" && event.executorId === "ordered"));
  assert.ok(events.some((event) => event.type === "stage.completed" && event.stageId === "review"));
  assert.equal(events.at(-1)?.type, "run.completed");
});

test("failed required stage stops later stages", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-fail-"));
  const seen: string[] = [];
  const registry = new StageExecutorRegistry([
    makeExecutor({
      run(stage) {
        seen.push(stage.stage.id);
        return {
          stageId: stage.stage.id,
          kind: stage.stage.kind,
          executor: "failing",
          status: stage.stage.id === "build" ? "failed" : "passed",
          summary: stage.stage.id === "build" ? "builder failed" : `passed ${stage.stage.id}`
        };
      }
    })
  ]);

  const result = await executeAuditedFlow({
    contract: {
      goal: "Add feature",
      workspace: "/tmp/workspace",
      flow: "feature-standard",
      stages: [
        { id: "plan", kind: "plan", executor: "ordered" },
        { id: "build", kind: "build", executor: "ordered" },
        { id: "review", kind: "review", executor: "ordered" }
      ]
    },
    orchestratorRoot,
    executorRegistry: registry,
    runIdFactory: () => "run-failed"
  });

  assert.deepEqual(seen, ["plan", "build"]);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.stageResults.map((stage) => [stage.stageId, stage.status]), [
    ["plan", "passed"],
    ["build", "failed"]
  ]);
});

test("skipped optional stage does not fail the run", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-skip-"));
  const registry = new StageExecutorRegistry([
    makeExecutor({
      run(stage) {
        return {
          stageId: stage.stage.id,
          kind: stage.stage.kind,
          executor: "ordered",
          status: "passed",
          summary: `passed ${stage.stage.id}`
        };
      }
    })
  ]);

  const result = await executeAuditedFlow({
    contract: {
      goal: "Add feature",
      workspace: "/tmp/workspace",
      flow: "feature-standard",
      stages: [
        { id: "plan", kind: "plan", executor: "ordered" },
        { id: "optional-review", kind: "review", executor: "ordered", required: false, onlyIf: ["stage:plan:failed"] }
      ]
    },
    orchestratorRoot,
    executorRegistry: registry,
    runIdFactory: () => "run-skipped"
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.stageResults.map((stage) => [stage.stageId, stage.status]), [
    ["plan", "passed"],
    ["optional-review", "skipped"]
  ]);
});

test("audit writer redacts obvious secret-like metadata keys", async () => {
  const auditDir = await mkdtemp(path.join(os.tmpdir(), "audited-flow-redaction-"));
  const writer = new FilesystemAuditedFlowAuditWriter(path.join(auditDir, "audit.ndjson"));

  await writer.append({
    type: "run.created",
    runId: "run-secret",
    occurredAt: "2026-06-09T00:00:00.000Z",
    payload: {
      apiKey: "super-secret",
      nested: {
        password: "pw",
        token: "abc123",
        keep: "value"
      }
    }
  });

  const saved = JSON.parse(await readFile(writer.auditPath, "utf8")) as {
    payload: { apiKey: string; nested: { password: string; token: string; keep: string } };
  };
  assert.equal(saved.payload.apiKey, "[REDACTED]");
  assert.equal(saved.payload.nested.password, "[REDACTED]");
  assert.equal(saved.payload.nested.token, "[REDACTED]");
  assert.equal(saved.payload.nested.keep, "value");
});

test("ShellCheckStageExecutor records command audit events and writes check artefacts", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-shell-pass-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-shell-workspace-"));
  const calls: Array<{ name: string; cwd: string }> = [];
  const registry = new StageExecutorRegistry([
    new ShellCheckStageExecutor({
      orchestratorRoot,
      config: makeConfig([
        { name: "unit", command: process.execPath, args: ["-e", 'console.log("unit")'], cwd: "workspace" },
        { name: "lint", command: process.execPath, args: ["-e", 'console.log("lint")'], cwd: "orchestrator" }
      ], workspaceRoot),
      execute: async (command) => {
        calls.push({ name: command.name, cwd: command.cwd });
        return {
          name: command.name,
          command: command.command,
          args: [...command.args],
          cwd: command.cwd,
          stdout: `${command.name} ok\n`,
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 12,
          success: true
        };
      }
    })
  ]);

  const result = await executeAuditedFlow({
    contract: {
      goal: "Run required checks",
      workspace: workspaceRoot,
      flow: "feature-standard",
      requiredChecks: ["unit"],
      stages: [{ id: "checks", kind: "check", executor: "shell-check" }]
    },
    orchestratorRoot,
    executorRegistry: registry,
    runIdFactory: () => "run-shell-pass"
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(calls, [{ name: "unit", cwd: workspaceRoot }]);
  const status = JSON.parse(
    await readFile(path.join(result.artefactsDir, "stages", "checks", "checks-status.json"), "utf8")
  ) as { state: string; total: number; completed: number };
  assert.deepEqual(status, {
    state: "executed",
    total: 1,
    completed: 1
  });

  const events = (await readFile(result.auditPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string; payload?: { name?: string } });
  assert.ok(events.some((event) => event.type === "command.started" && event.payload?.name === "unit"));
  assert.ok(events.some((event) => event.type === "command.completed" && event.payload?.name === "unit"));
});

test("ShellCheckStageExecutor fails the audited flow when a configured check fails", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-shell-fail-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "audited-flow-shell-fail-workspace-"));
  const registry = new StageExecutorRegistry([
    new ShellCheckStageExecutor({
      orchestratorRoot,
      config: makeConfig([{ name: "unit", command: process.execPath, args: ["-e", 'process.exit(2)'], cwd: "workspace" }], workspaceRoot),
      execute: async (command) => ({
        name: command.name,
        command: command.command,
        args: [...command.args],
        cwd: command.cwd,
        stdout: "",
        stderr: "failed\n",
        exitCode: 2,
        signal: null,
        durationMs: 8,
        success: false
      })
    })
  ]);

  const result = await executeAuditedFlow({
    contract: {
      goal: "Run required checks",
      workspace: workspaceRoot,
      flow: "feature-standard",
      stages: [{ id: "checks", kind: "check", executor: "shell-check" }]
    },
    orchestratorRoot,
    executorRegistry: registry,
    runIdFactory: () => "run-shell-fail"
  });

  assert.equal(result.status, "failed");
  assert.equal(result.stageResults[0]?.status, "failed");
  assert.match(result.stageResults[0]?.summary ?? "", /Check "unit" failed with exit code 2/);
  const events = (await readFile(result.auditPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string });
  assert.equal(events.at(-1)?.type, "run.failed");
});

function makeExecutor(input: {
  run(stage: {
    runId: string;
    contract: RunContract;
    previousResults: StageResult[];
    stage: RunContract["stages"][number];
    artefactsDir: string;
    workspace: string;
    dryRun?: boolean;
  }): StageResult | Promise<StageResult>;
}): StageExecutor {
  return {
    id: "ordered",
    capabilities: {
      stageKinds: ["plan", "build", "check", "review", "fix", "final-review", "approval", "report", "github"],
      writesWorkspace: false
    },
    run(stage) {
      return Promise.resolve(input.run(stage));
    }
  };
}

function makeConfig(checks: OrchestratorConfig["commands"]["checks"], workspaceRoot: string): OrchestratorConfig {
  return {
    version: 1,
    projectName: "MergeWright",
    workspaceRoot,
    paths: {
      stagesDir: ".artifacts/stages",
      promptsDir: ".artifacts/prompts",
      runsDir: ".artifacts/runs"
    },
    executionBackends: {
      codex: { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
      builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" }
    },
    pipeline: {
      finalReview: true,
      maxFixLoops: 1
    },
    commands: {
      checks
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
      captureDiffBeforeAfter: false,
      requireReviewAfterWrites: false,
      autoCommit: false,
      autoPush: false
    }
  };
}
