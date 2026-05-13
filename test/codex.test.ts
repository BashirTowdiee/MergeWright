import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCodexExecArgs,
  parseCodexExecHelp,
  validateCodexExecutionRequest,
  DEFAULT_CODEX_EXEC_CAPABILITIES,
  type CodexExecutionRequest,
  type CodexExecCapabilities
} from "../src/codex.js";

const requestBase: CodexExecutionRequest = {
  prompt: "plan this stage",
  role: "planner",
  model: "gpt-5.3-codex",
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
    "gpt-5.3-codex",
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
    () => validateCodexExecutionRequest({ ...requestBase, sandboxMode: "bad-mode" as "read-only" }, fullCaps),
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
    () => validateCodexExecutionRequest(requestBase, { ...fullCaps, hasSandboxFlag: false }),
    /sandbox flag/,
  );
});

test("missing output-last-message capability fails closed", () => {
  assert.throws(
    () => validateCodexExecutionRequest(requestBase, { ...fullCaps, hasOutputLastMessageFlag: false }),
    /output-last-message flag/,
  );
});

test("invalid empty prompt fails", () => {
  assert.throws(
    () => validateCodexExecutionRequest({ ...requestBase, prompt: "   " }, fullCaps),
    /prompt must be non-empty/,
  );
});

test("invalid empty model fails", () => {
  assert.throws(
    () => validateCodexExecutionRequest({ ...requestBase, model: "" }, fullCaps),
    /model must be non-empty/,
  );
});

test("invalid empty reasoning effort fails", () => {
  assert.throws(
    () => validateCodexExecutionRequest({ ...requestBase, reasoningEffort: "" }, fullCaps),
    /reasoningEffort must be non-empty/,
  );
});

test("non-absolute output-last-message path fails", () => {
  assert.throws(
    () => validateCodexExecutionRequest({ ...requestBase, outputLastMessagePath: "runs/out.md" }, fullCaps),
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
