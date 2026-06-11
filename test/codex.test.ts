import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildCodexExecArgs,
  executeCodex,
  parseCodexExecHelp,
  validateAgentExecutionRequest,
  DEFAULT_CODEX_EXEC_CAPABILITIES,
  type AgentExecutionRequest,
  type CodexExecCapabilities
} from "../src/codex.js";

const requestBase: AgentExecutionRequest = {
  prompt: "plan this stage",
  role: "planner",
  model: "gpt-5.5",
  reasoningEffort: "high",
  workspaceRoot: "/tmp/workspace",
  outputLastMessagePath: "/tmp/orchestrator/runs/out.md",
  dryRun: false,
  requireGitRepo: true,
  orchestratorRoot: "/tmp/orchestrator"
};

const fullCaps: CodexExecCapabilities = { ...DEFAULT_CODEX_EXEC_CAPABILITIES };

test("parses installed codex exec help flags", () => {
  const help = `--model\n--config\n--cd\n--output-last-message\n--sandbox\n--skip-git-repo-check`;
  const parsed = parseCodexExecHelp(help);
  assert.deepEqual(parsed, fullCaps);
});

test("builds args with mandatory safety flags and excludes prompt from argv", () => {
  const command = buildCodexExecArgs(requestBase, fullCaps);

  assert.equal(command.command, "codex");
  assert.equal(command.cwd, "/tmp/orchestrator");
  assert.equal(command.promptStdin, "plan this stage");
  assert.deepEqual(command.args.slice(0, 11), [
    "exec",
    "-m",
    "gpt-5.5",
    "-c",
    'model_reasoning_effort="high"',
    "-C",
    "/tmp/workspace",
    "-o",
    "/tmp/orchestrator/runs/out.md",
    "-s",
    "read-only"
  ]);
  assert.ok(command.args.includes("-"));
  assert.equal(command.args.join(" ").includes("plan this stage"), false);
});

test("read-only sandbox flag is always present when capability exists", () => {
  const command = buildCodexExecArgs(requestBase, fullCaps);
  assert.ok(command.args.includes("-s"));
  assert.ok(command.args.includes("read-only"));
});

test("workspace-write sandbox appears only when requested", () => {
  const command = buildCodexExecArgs({ ...requestBase, role: "builder", sandboxMode: "workspace-write" }, fullCaps);
  assert.ok(command.args.includes("-s"));
  assert.ok(command.args.includes("workspace-write"));
  assert.equal(command.args.includes("read-only"), false);
});

test("invalid sandbox mode fails", () => {
  assert.throws(
    () => validateAgentExecutionRequest({ ...requestBase, sandboxMode: "bad-mode" as "read-only" }, fullCaps),
    /sandboxMode must be read-only or workspace-write/
  );
});

test("output-last-message flag is always present when capability exists", () => {
  const command = buildCodexExecArgs(requestBase, fullCaps);
  assert.ok(command.args.includes("-o"));
  assert.ok(command.args.includes("/tmp/orchestrator/runs/out.md"));
});

test("missing sandbox capability fails closed", () => {
  assert.throws(
    () => validateAgentExecutionRequest(requestBase, { ...fullCaps, hasSandboxFlag: false }),
    /sandbox flag/,
  );
});

test("missing output-last-message capability fails closed", () => {
  assert.throws(
    () => validateAgentExecutionRequest(requestBase, { ...fullCaps, hasOutputLastMessageFlag: false }),
    /output-last-message flag/,
  );
});

test("invalid empty prompt fails", () => {
  assert.throws(
    () => validateAgentExecutionRequest({ ...requestBase, prompt: "   " }, fullCaps),
    /prompt must be non-empty/,
  );
});

test("invalid empty model fails", () => {
  assert.throws(
    () => validateAgentExecutionRequest({ ...requestBase, model: "" }, fullCaps),
    /model must be non-empty/,
  );
});

test("invalid empty reasoning effort fails", () => {
  assert.throws(
    () => validateAgentExecutionRequest({ ...requestBase, reasoningEffort: "" }, fullCaps),
    /reasoningEffort must be non-empty/,
  );
});

test("non-absolute output-last-message path fails", () => {
  assert.throws(
    () => validateAgentExecutionRequest({ ...requestBase, outputLastMessagePath: "runs/out.md" }, fullCaps),
    /must be an absolute path/,
  );
});

test("skip-git-repo-check only appears when requireGitRepo=false", () => {
  const withSkip = buildCodexExecArgs({ ...requestBase, requireGitRepo: false }, fullCaps);
  assert.ok(withSkip.args.includes("--skip-git-repo-check"));

  const withoutSkip = buildCodexExecArgs({ ...requestBase, requireGitRepo: true }, fullCaps);
  assert.equal(withoutSkip.args.includes("--skip-git-repo-check"), false);
});

test("builder role uses provided model and reasoning effort", () => {
  const command = buildCodexExecArgs(
    {
      ...requestBase,
      role: "builder",
      model: "gpt-5.5",
      reasoningEffort: "medium"
    },
    fullCaps
  );

  assert.deepEqual(command.args.slice(0, 5), ["exec", "-m", "gpt-5.5", "-c", 'model_reasoning_effort="medium"']);
  assert.equal(command.args.join(" ").includes("plan this stage"), false);
  assert.ok(command.args.includes("-s"));
  assert.ok(command.args.includes("read-only"));
});

test("reviewer role uses provided model and reasoning effort", () => {
  const command = buildCodexExecArgs(
    {
      ...requestBase,
      role: "reviewer",
      model: "gpt-5.5",
      reasoningEffort: "low"
    },
    fullCaps
  );

  assert.deepEqual(command.args.slice(0, 5), ["exec", "-m", "gpt-5.5", "-c", 'model_reasoning_effort="low"']);
  assert.equal(command.args.join(" ").includes("plan this stage"), false);
  assert.ok(command.args.includes("-s"));
  assert.ok(command.args.includes("read-only"));
});

test("executeCodex streams chunk callbacks and still captures full stdout/stderr", async () => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "codex-bin-"));
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
    const result = await executeCodex(
      { ...requestBase, outputLastMessagePath, orchestratorRoot: binDir },
      fullCaps,
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

test("executeCodex fails closed when stdout stream callback throws", async () => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "codex-bin-"));
  const codexPath = path.join(binDir, "codex");
  await writeFile(
    codexPath,
    `#!/usr/bin/env node
process.stdout.write("stdout-before\\n");
setTimeout(() => process.stdout.write("stdout-after\\n"), 20);
setTimeout(() => process.stderr.write("stderr-after\\n"), 30);
setTimeout(() => process.exit(0), 80);
`,
    "utf8"
  );
  await chmod(codexPath, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  try {
    const result = await executeCodex(
      { ...requestBase, outputLastMessagePath: path.join(binDir, "out.md"), orchestratorRoot: binDir },
      fullCaps,
      {
        onStdoutChunk: () => {
          throw new Error("stdout boom");
        }
      }
    );
    assert.equal(result.success, false);
    assert.match(result.stderr, /Codex stream callback failed during stdout streaming: stdout boom/);
    assert.match(result.stdout, /stdout-before/);
  } finally {
    process.env.PATH = originalPath;
  }
});

test("executeCodex fails closed when stderr stream callback throws", async () => {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "codex-bin-"));
  const codexPath = path.join(binDir, "codex");
  await writeFile(
    codexPath,
    `#!/usr/bin/env node
process.stderr.write("stderr-before\\n");
setTimeout(() => process.stdout.write("stdout-after\\n"), 20);
setTimeout(() => process.stderr.write("stderr-after\\n"), 30);
setTimeout(() => process.exit(0), 80);
`,
    "utf8"
  );
  await chmod(codexPath, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  try {
    const result = await executeCodex(
      { ...requestBase, outputLastMessagePath: path.join(binDir, "out.md"), orchestratorRoot: binDir },
      fullCaps,
      {
        onStderrChunk: () => {
          throw new Error("stderr boom");
        }
      }
    );
    assert.equal(result.success, false);
    assert.match(result.stderr, /stderr-before/);
    assert.match(result.stderr, /Codex stream callback failed during stderr streaming: stderr boom/);
  } finally {
    process.env.PATH = originalPath;
  }
});
