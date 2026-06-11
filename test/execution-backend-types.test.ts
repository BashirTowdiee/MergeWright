import test from "node:test";
import assert from "node:assert/strict";
import type {
  AgentExecutionRequest,
  AgentExecutionResult,
  ExecutionBackend
} from "../src/execution-backends/execution-backend-types.js";

const mockBackend: ExecutionBackend = {
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
  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    return {
      backendName: request.backendName,
      backendType: request.backendType,
      model: request.model,
      command: "mock-agent",
      args: ["run"],
      cwd: request.orchestratorRoot,
      stdout: "mock stdout",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 1,
      success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: "mock output",
      skipped: request.dryRun
    };
  }
};

test("mock backend implements the execution backend contract", async () => {
  const request: AgentExecutionRequest = {
    prompt: "plan this stage",
    role: "planner",
    backendName: "codex-local",
    backendType: "codex-cli",
    model: "gpt-5.5",
    reasoningEffort: "high",
    workspaceRoot: "/tmp/workspace",
    outputLastMessagePath: "/tmp/orchestrator/runs/out.md",
    dryRun: false,
    requireGitRepo: true,
    orchestratorRoot: "/tmp/orchestrator",
    sandboxMode: "read-only"
  };

  assert.equal(mockBackend.type, "codex-cli");
  assert.deepEqual(mockBackend.capabilities, {
    providesHarness: true,
    supportsLocalWorkspace: true,
    supportsFileEdits: true,
    supportsShellCommands: true,
    supportsSandboxMode: true,
    supportsStreaming: true,
    supportsReasoningEffort: true,
    supportsModelSelection: true
  });

  const result = await mockBackend.execute(request);

  assert.equal(result.backendName, "codex-local");
  assert.equal(result.backendType, "codex-cli");
  assert.equal(result.model, "gpt-5.5");
  assert.equal(result.success, true);
  assert.equal(result.outputLastMessagePath, "/tmp/orchestrator/runs/out.md");
  assert.equal(result.outputLastMessage, "mock output");
});
