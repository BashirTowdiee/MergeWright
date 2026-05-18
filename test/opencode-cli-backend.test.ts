import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENCODE_CLI_BACKEND_CAPABILITIES,
  OpenCodeCliBackend
} from "../src/execution-backends/opencode-cli-backend.js";
import { validateBackendCapabilitiesForRole } from "../src/execution-backends/execution-backend-capabilities.js";
import type { AgentExecutionRequest, ExecutionBackend } from "../src/execution-backends/execution-backend-types.js";

const request: AgentExecutionRequest = {
  prompt: "review this change",
  role: "reviewer",
  backendName: "opencode-reviewer",
  backendType: "opencode-cli",
  model: "anthropic/claude-sonnet-4.5",
  reasoningEffort: "high",
  workspaceRoot: "/tmp/workspace",
  outputLastMessagePath: "/tmp/run/opencode-output.md",
  dryRun: false,
  requireGitRepo: true,
  orchestratorRoot: "/tmp/orchestrator",
  sandboxMode: "read-only"
};

test("OpenCodeCliBackend implements ExecutionBackend", () => {
  const backend: ExecutionBackend = new OpenCodeCliBackend();

  assert.equal(backend.type, "opencode-cli");
  assert.deepEqual(backend.capabilities, OPENCODE_CLI_BACKEND_CAPABILITIES);
});

test("OpenCodeCliBackend exposes conservative capabilities", () => {
  assert.deepEqual(OPENCODE_CLI_BACKEND_CAPABILITIES, {
    providesHarness: true,
    supportsLocalWorkspace: true,
    supportsFileEdits: false,
    supportsShellCommands: false,
    supportsSandboxMode: false,
    supportsStreaming: false,
    supportsReasoningEffort: false,
    supportsModelSelection: true
  });
});

test("OpenCodeCliBackend execute fails clearly", async () => {
  const backend = new OpenCodeCliBackend();

  await assert.rejects(
    () => backend.execute(request),
    /Execution backend type "opencode-cli" is recognised but execution is not implemented yet\./
  );
});

test("OpenCodeCliBackend capability validation rejects builder role", () => {
  assert.throws(
    () =>
      validateBackendCapabilitiesForRole({
        backendName: "opencode-reviewer",
        backend: new OpenCodeCliBackend(),
        role: "builder"
      }),
    /Missing capabilities: supportsFileEdits, supportsShellCommands, supportsSandboxMode\./
  );
});

test("OpenCodeCliBackend capability validation rejects fixer role", () => {
  assert.throws(
    () =>
      validateBackendCapabilitiesForRole({
        backendName: "opencode-reviewer",
        backend: new OpenCodeCliBackend(),
        role: "fixer"
      }),
    /Missing capabilities: supportsFileEdits, supportsShellCommands, supportsSandboxMode\./
  );
});

test("OpenCodeCliBackend capability validation rejects planner and reviewer until sandbox is implemented", () => {
  for (const role of ["planner", "reviewer"] as const) {
    assert.throws(
      () =>
        validateBackendCapabilitiesForRole({
          backendName: "opencode-reviewer",
          backend: new OpenCodeCliBackend(),
          role
        }),
      /Missing capabilities: supportsSandboxMode\./
    );
  }
});
