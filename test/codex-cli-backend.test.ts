import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildCodexExecArgs, DEFAULT_CODEX_EXEC_CAPABILITIES, type AgentExecutionRequest as CodexRunRequest } from "../src/codex.js";
import { CODEX_CLI_BACKEND_CAPABILITIES, CodexCliBackend } from "../src/execution-backends/codex-cli-backend.js";
import type { AgentExecutionRequest, ExecutionBackend } from "../src/execution-backends/execution-backend-types.js";

const agentRequestBase: AgentExecutionRequest = {
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

const codexRequestBase: CodexRunRequest = {
  prompt: "plan this stage",
  role: "planner",
  model: "gpt-5.5",
  reasoningEffort: "high",
  workspaceRoot: "/tmp/workspace",
  outputLastMessagePath: "/tmp/orchestrator/runs/out.md",
  dryRun: false,
  requireGitRepo: true,
  orchestratorRoot: "/tmp/orchestrator",
  sandboxMode: "read-only"
};

test("CodexCliBackend implements the execution backend contract", () => {
  const backend: ExecutionBackend = new CodexCliBackend();

  assert.equal(backend.type, "codex-cli");
  assert.deepEqual(backend.capabilities, CODEX_CLI_BACKEND_CAPABILITIES);
});

test("CodexCliBackend exposes expected capabilities", () => {
  assert.deepEqual(CODEX_CLI_BACKEND_CAPABILITIES, {
    providesHarness: true,
    supportsLocalWorkspace: true,
    supportsFileEdits: true,
    supportsShellCommands: true,
    supportsSandboxMode: true,
    supportsStreaming: true,
    supportsReasoningEffort: true,
    supportsModelSelection: true
  });
});

test("CodexCliBackend dry-run preserves Codex command semantics", async () => {
  const backend = new CodexCliBackend();
  const expected = buildCodexExecArgs({ ...codexRequestBase, dryRun: true }, DEFAULT_CODEX_EXEC_CAPABILITIES);

  const result = await backend.execute({ ...agentRequestBase, dryRun: true });

  assert.equal(result.backendName, "codex-local");
  assert.equal(result.backendType, "codex-cli");
  assert.equal(result.model, "gpt-5.5");
  assert.equal(result.command, expected.command);
  assert.deepEqual(result.args, expected.args);
  assert.equal(result.cwd, expected.cwd);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Codex execution skipped because dryRun=true.");
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(result.durationMs, 0);
  assert.equal(result.success, true);
  assert.equal(result.outputLastMessagePath, "/tmp/orchestrator/runs/out.md");
  assert.equal(result.outputLastMessage, "");
  assert.equal(result.skipped, true);
});

test("CodexCliBackend matches Codex args for workspace-write and skip git repo check", async () => {
  const backend = new CodexCliBackend();
  const agentRequest: AgentExecutionRequest = {
    ...agentRequestBase,
    role: "builder",
    dryRun: true,
    requireGitRepo: false,
    sandboxMode: "workspace-write"
  };
  const codexRequest: CodexRunRequest = {
    ...codexRequestBase,
    role: "builder",
    dryRun: true,
    requireGitRepo: false,
    sandboxMode: "workspace-write"
  };
  const expected = buildCodexExecArgs(codexRequest, DEFAULT_CODEX_EXEC_CAPABILITIES);

  const result = await backend.execute(agentRequest);

  assert.deepEqual(result.args, expected.args);
  assert.ok(result.args?.includes("workspace-write"));
  assert.ok(result.args?.includes("--skip-git-repo-check"));
});

test("CodexCliBackend passes streaming callbacks through to Codex execution", async () => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "codex-backend-bin-"));
  const codexPath = path.join(binDir, "codex");
  await writeFile(
    codexPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
process.stdout.write("stdout-chunk-1\\n");
process.stderr.write("stderr-chunk-1\\n");
setTimeout(() => {
  process.stdout.write("stdout-chunk-2\\n");
  process.stderr.write("stderr-chunk-2\\n");
  if (outputPath) fs.writeFileSync(outputPath, "# last message\\n", "utf8");
  process.exit(0);
}, 10);
`,
    "utf8"
  );
  await chmod(codexPath, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  try {
    const outputLastMessagePath = path.join(binDir, "output-last-message.md");
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const backend = new CodexCliBackend();
    const result = await backend.execute(
      { ...agentRequestBase, outputLastMessagePath, orchestratorRoot: binDir },
      {
        onStdoutChunk: (chunk) => stdoutChunks.push(chunk),
        onStderrChunk: (chunk) => stderrChunks.push(chunk)
      }
    );

    assert.deepEqual(stdoutChunks, ["stdout-chunk-1\n", "stdout-chunk-2\n"]);
    assert.deepEqual(stderrChunks, ["stderr-chunk-1\n", "stderr-chunk-2\n"]);
    assert.equal(result.stdout, "stdout-chunk-1\nstdout-chunk-2\n");
    assert.equal(result.stderr, "stderr-chunk-1\nstderr-chunk-2\n");
    assert.equal(result.outputLastMessage, "# last message\n");
    assert.equal(result.success, true);
  } finally {
    process.env.PATH = originalPath;
  }
});
