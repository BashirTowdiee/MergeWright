import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenCodeReadOnlyCommand,
  OPENCODE_CLI_BACKEND_CAPABILITIES,
  OpenCodeCliBackend,
  type OpenCodeExecutionRequest
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

const openCodeRequest: OpenCodeExecutionRequest = {
  prompt: "review this change",
  role: "reviewer",
  model: "anthropic/claude-sonnet-4.5",
  workspaceRoot: "/tmp/workspace",
  outputLastMessagePath: "/tmp/run/opencode-output.md",
  orchestratorRoot: "/tmp/orchestrator",
  dryRun: true
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

test("OpenCode read-only command defaults to opencode", () => {
  const built = buildOpenCodeReadOnlyCommand(openCodeRequest);

  assert.equal(built.command, "opencode");
  assert.deepEqual(built.args, [
    "run",
    "--model",
    "anthropic/claude-sonnet-4.5",
    "--cwd",
    "/tmp/workspace",
    "--output",
    "/tmp/run/opencode-output.md",
    "-"
  ]);
  assert.equal(built.cwd, "/tmp/orchestrator");
  assert.equal(built.promptStdin, "review this change");
});

test("OpenCode read-only command accepts a custom executable name", () => {
  const built = buildOpenCodeReadOnlyCommand({ ...openCodeRequest, command: "opencode-dev" });

  assert.equal(built.command, "opencode-dev");
});

test("OpenCode read-only command builds planner, reviewer, fix-planner, and reassessor roles", () => {
  for (const role of ["planner", "reviewer", "fix-planner", "reassessor"] as const) {
    const built = buildOpenCodeReadOnlyCommand({ ...openCodeRequest, role });
    assert.equal(built.command, "opencode");
    assert.equal(built.promptStdin, "review this change");
  }
});

test("OpenCode read-only command rejects builder and fixer roles", () => {
  for (const role of ["builder", "fixer"] as const) {
    assert.throws(
      () => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, role }),
      /role must be one of planner\|reviewer\|fix-planner\|reassessor/
    );
  }
});

test("OpenCode read-only command validates required fields", () => {
  assert.throws(() => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, prompt: "" }), /prompt must be non-empty/);
  assert.throws(() => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, model: "" }), /model must be non-empty/);
  assert.throws(() => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, workspaceRoot: "" }), /workspaceRoot is required/);
  assert.throws(() => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, orchestratorRoot: "" }), /orchestratorRoot is required/);
  assert.throws(
    () => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, outputLastMessagePath: "" }),
    /outputLastMessagePath is required/
  );
  assert.throws(
    () => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, outputLastMessagePath: "relative-output.md" }),
    /outputLastMessagePath must be an absolute path/
  );
});

test("OpenCode read-only command validates custom command", () => {
  assert.throws(() => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, command: "" }), /command must be non-empty/);
  assert.throws(
    () => buildOpenCodeReadOnlyCommand({ ...openCodeRequest, command: "npx opencode" }),
    /command must be an executable name only/
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
