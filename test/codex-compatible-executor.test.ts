import test from "node:test";
import assert from "node:assert/strict";
import { createCodexCompatibleExecutor } from "../src/execution-backends/codex-compatible-executor.js";
import type { OrchestratorConfig } from "../src/config.js";
import type { CodexExecutor } from "../src/codex.js";
import type { ExecutionBackend, AgentExecutionRequest } from "../src/execution-backends/execution-backend-types.js";
import type { ExecutionBackendRegistry } from "../src/execution-backends/execution-backend-registry.js";

function makeConfig(): OrchestratorConfig {
  return {
    version: 1,
    projectName: "acme",
    workspaceRoot: "/tmp/workspace",
    paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
    codex: {
      planner: { model: "legacy-planner", reasoningEffort: "legacy-high" },
      builder: { model: "legacy-builder", reasoningEffort: "legacy-medium" },
      reviewer: { model: "legacy-reviewer", reasoningEffort: "legacy-high" }
    },
    executionBackends: {
      "codex-local": { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex-local", model: "agent-planner", reasoningEffort: "high" },
      builder: { backend: "codex-local", model: "agent-builder", reasoningEffort: "medium" },
      reviewer: { backend: "codex-local", model: "agent-reviewer", reasoningEffort: "high" }
    },
    pipeline: { finalReview: true, maxFixLoops: 1 },
    commands: { checks: [] },
    safety: {
      requireGitRepo: true,
      requireCleanStart: true,
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    },
    writeSafety: {
      enabled: false,
      allowedBranches: ["feature/*"],
      blockedPaths: [".git/"],
      requireCleanWorkingTree: true,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: true,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  };
}

function makeRegistry(backend: ExecutionBackend): ExecutionBackendRegistry {
  return {
    get(name: string) {
      assert.equal(name, "codex-local");
      return backend;
    },
    list() {
      return [{ name: "codex-local", type: "codex-cli" as const }];
    }
  };
}

test("codex-compatible executor delegates to configured backend and agent model", async () => {
  let capturedRequest: AgentExecutionRequest | undefined;
  const backend: ExecutionBackend = {
    type: "codex-cli",
    capabilities: {
      providesHarness: true,
      supportsLocalWorkspace: true,
      supportsFileEdits: true,
      supportsShellCommands: true,
      supportsSandboxMode: true,
      supportsStreaming: true,
      supportsReasoningEffort: true,
      supportsModelSelection: true
    },
    async execute(request) {
      capturedRequest = request;
      return {
        backendName: request.backendName,
        backendType: request.backendType,
        model: request.model,
        command: "codex",
        args: ["exec"],
        cwd: request.orchestratorRoot,
        stdout: "stdout",
        stderr: "stderr",
        exitCode: 0,
        signal: null,
        durationMs: 12,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "last message",
        skipped: false
      };
    }
  };

  const executor = createCodexCompatibleExecutor(makeConfig(), { registry: makeRegistry(backend) });
  const result = await executor(
    {
      prompt: "prompt",
      role: "builder",
      model: "legacy-request-model",
      reasoningEffort: "legacy-request-reasoning",
      workspaceRoot: "/tmp/workspace",
      outputLastMessagePath: "/tmp/run/out.md",
      dryRun: false,
      requireGitRepo: true,
      orchestratorRoot: "/tmp/orchestrator",
      sandboxMode: "workspace-write"
    },
    { streamOutput: true }
  );

  assert.deepEqual(capturedRequest, {
    prompt: "prompt",
    role: "builder",
    backendName: "codex-local",
    backendType: "codex-cli",
    model: "agent-builder",
    reasoningEffort: "medium",
    workspaceRoot: "/tmp/workspace",
    outputLastMessagePath: "/tmp/run/out.md",
    dryRun: false,
    requireGitRepo: true,
    orchestratorRoot: "/tmp/orchestrator",
    sandboxMode: "workspace-write"
  });
  assert.deepEqual(result, {
    command: "codex",
    args: ["exec"],
    cwd: "/tmp/orchestrator",
    stdout: "stdout",
    stderr: "stderr",
    exitCode: 0,
    signal: null,
    durationMs: 12,
    success: true,
    outputLastMessagePath: "/tmp/run/out.md",
    outputLastMessage: "last message",
    skipped: false
  });
});

test("codex-compatible executor preserves explicit codexExecutor override", async () => {
  const override: CodexExecutor = async (request) => ({
    command: "override",
    args: [request.role],
    cwd: request.orchestratorRoot,
    stdout: "",
    stderr: "",
    exitCode: 0,
    signal: null,
    durationMs: 0,
    success: true,
    outputLastMessagePath: request.outputLastMessagePath,
    outputLastMessage: request.model,
    skipped: false
  });

  const executor = createCodexCompatibleExecutor(makeConfig(), { overrideCodexExecutor: override });
  const result = await executor({
    prompt: "prompt",
    role: "planner",
    model: "request-model",
    reasoningEffort: "high",
    workspaceRoot: "/tmp/workspace",
    outputLastMessagePath: "/tmp/run/out.md",
    dryRun: false,
    requireGitRepo: true,
    orchestratorRoot: "/tmp/orchestrator",
    sandboxMode: "read-only"
  });

  assert.equal(result.command, "override");
  assert.deepEqual(result.args, ["planner"]);
  assert.equal(result.outputLastMessage, "request-model");
});

test("codex-compatible executor rejects stale unknown backend references", async () => {
  const config = makeConfig();
  config.agents.planner = { backend: "missing", model: "x", reasoningEffort: "high" };
  const executor = createCodexCompatibleExecutor(config, {
    registry: {
      get() {
        throw new Error("registry should not be called");
      },
      list() {
        return [];
      }
    }
  });

  await assert.rejects(
    () =>
      executor({
        prompt: "prompt",
        role: "planner",
        model: "legacy",
        reasoningEffort: "high",
        workspaceRoot: "/tmp/workspace",
        outputLastMessagePath: "/tmp/run/out.md",
        dryRun: false,
        requireGitRepo: true,
        orchestratorRoot: "/tmp/orchestrator",
        sandboxMode: "read-only"
      }),
    /agent "planner" references unknown execution backend "missing"/
  );
});
