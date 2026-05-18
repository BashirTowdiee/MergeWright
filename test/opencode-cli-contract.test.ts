import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAndValidateOpenCodeReadOnlyCommand,
  probeOpenCodeCliContract,
  type OpenCodeCliContract,
  validateOpenCodeReadOnlyCommandAgainstContract,
  validateOpenCodeProbeCommand
} from "../src/execution-backends/opencode-cli-contract.js";
import type { OpenCodeBuiltCommand, OpenCodeExecutionRequest } from "../src/execution-backends/opencode-cli-backend.js";

const TEST_PROBE_TIMEOUT_MS = 30_000;

async function makeFakeOpenCodeBin(scriptBody: string): Promise<{ binDir: string; command: string; logPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencode-contract-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir, { recursive: true });
  const command = "opencode";
  const logPath = path.join(root, "calls.log");
  const scriptPath = path.join(binDir, command);
  await writeFile(scriptPath, scriptBody.replaceAll("__LOG_PATH__", logPath), "utf8");
  await chmod(scriptPath, 0o755);
  return { binDir, command, logPath };
}

function envWithPath(binDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`
  };
}

const happyFakeCli = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "__LOG_PATH__"
if [ "$#" -eq 1 ] && [ "$1" = "--version" ]; then
  printf 'opencode 1.2.3\n'
  exit 0
fi
if [ "$#" -eq 1 ] && [ "$1" = "--help" ]; then
  cat <<'HELP'
Usage: opencode <command>
Commands:
  run      Run an agent task
HELP
  exit 0
fi
if [ "$#" -eq 2 ] && [ "$1" = "run" ] && [ "$2" = "--help" ]; then
  cat <<'HELP'
Usage: opencode run [options] -
Options:
  --model <model>
  --cwd <path>
  --output <path>
Prompt is read from stdin when '-' is used.
HELP
  exit 0
fi
printf 'unexpected invocation: %s\n' "$*" >&2
exit 42
`;

test("probeOpenCodeCliContract detects supported OpenCode contract from help output", async () => {
  const fake = await makeFakeOpenCodeBin(happyFakeCli);

  const result = await probeOpenCodeCliContract({
    command: fake.command,
    env: envWithPath(fake.binDir),
    timeoutMs: TEST_PROBE_TIMEOUT_MS
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.contract.command, "opencode");
  assert.deepEqual(result.contract.versionCommand, ["--version"]);
  assert.deepEqual(result.contract.helpCommand, ["--help"]);
  assert.deepEqual(result.contract.runHelpCommand, ["run", "--help"]);
  assert.equal(result.contract.supportsRunSubcommand, true);
  assert.equal(result.contract.supportsModelFlag, true);
  assert.equal(result.contract.supportsCwdFlag, true);
  assert.equal(result.contract.supportsOutputFlag, true);
  assert.equal(result.contract.supportsStdinPrompt, true);
  assert.match(result.contract.verifiedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.stdout, /opencode 1\.2\.3/);

  const calls = (await readFile(fake.logPath, "utf8")).trim().split("\n").sort();
  assert.deepEqual(calls, ["--help", "--version", "run --help"].sort());
});

test("probeOpenCodeCliContract reports missing command as failed probe", async () => {
  const result = await probeOpenCodeCliContract({ command: "missing-opencode-command-for-test" });

  assert.equal(result.ok, false);
  assert.equal(result.contract.command, "missing-opencode-command-for-test");
  assert.ok(result.errors.some((error) => error.includes("version probe failed")));
  assert.ok(result.errors.some((error) => error.includes("help probe failed")));
  assert.ok(result.errors.some((error) => error.includes("run-help probe failed")));
});

test("validateOpenCodeProbeCommand rejects invalid command names", () => {
  assert.throws(() => validateOpenCodeProbeCommand(""), /command must be non-empty/);
  assert.throws(() => validateOpenCodeProbeCommand("npx opencode"), /executable name only/);
});

test("probeOpenCodeCliContract rejects invalid command names", async () => {
  await assert.rejects(() => probeOpenCodeCliContract({ command: "" }), /command must be non-empty/);
  await assert.rejects(() => probeOpenCodeCliContract({ command: "npx opencode" }), /executable name only/);
});

test("probeOpenCodeCliContract reports partial contract support conservatively", async () => {
  const fake = await makeFakeOpenCodeBin(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "__LOG_PATH__"
if [ "$#" -eq 1 ] && [ "$1" = "--version" ]; then
  printf 'opencode 1.2.3\n'
  exit 0
fi
if [ "$#" -eq 1 ] && [ "$1" = "--help" ]; then
  printf 'Commands:\n  run\n'
  exit 0
fi
if [ "$#" -eq 2 ] && [ "$1" = "run" ] && [ "$2" = "--help" ]; then
  printf 'Options:\n  --model <model>\n  --cwd <path>\nPrompt from stdin using -\n'
  exit 0
fi
exit 42
`);

  const result = await probeOpenCodeCliContract({
    command: fake.command,
    env: envWithPath(fake.binDir),
    timeoutMs: TEST_PROBE_TIMEOUT_MS
  });

  assert.equal(result.ok, false);
  assert.equal(result.contract.supportsRunSubcommand, true);
  assert.equal(result.contract.supportsModelFlag, true);
  assert.equal(result.contract.supportsCwdFlag, true);
  assert.equal(result.contract.supportsOutputFlag, false);
  assert.equal(result.contract.supportsStdinPrompt, true);
  assert.ok(result.errors.some((error) => error.includes("output flag")));
});

test("probeOpenCodeCliContract only calls version/help/run-help and never executes a prompt", async () => {
  const fake = await makeFakeOpenCodeBin(happyFakeCli);

  const result = await probeOpenCodeCliContract({
    command: fake.command,
    env: envWithPath(fake.binDir),
    timeoutMs: TEST_PROBE_TIMEOUT_MS
  });

  assert.equal(result.ok, true);
  const calls = (await readFile(fake.logPath, "utf8")).trim().split("\n").sort();
  assert.deepEqual(calls, ["--help", "--version", "run --help"].sort());
  assert.ok(calls.every((call) => call !== "run" && !call.includes("--output")));
});

function makeContract(overrides: Partial<OpenCodeCliContract> = {}): OpenCodeCliContract {
  return {
    command: "opencode",
    versionCommand: ["--version"],
    helpCommand: ["--help"],
    runHelpCommand: ["run", "--help"],
    supportsRunSubcommand: true,
    supportsModelFlag: true,
    supportsCwdFlag: true,
    supportsOutputFlag: true,
    supportsStdinPrompt: true,
    verifiedAt: "2026-05-18T00:00:00.000Z",
    ...overrides
  };
}

function makeBuiltCommand(overrides: Partial<OpenCodeBuiltCommand> = {}): OpenCodeBuiltCommand {
  return {
    command: "opencode",
    args: ["run", "--model", "anthropic/claude-sonnet-4.5", "--cwd", "/tmp/workspace", "--output", "/tmp/out.md", "-"],
    cwd: "/tmp/orchestrator",
    promptStdin: "review this change",
    ...overrides
  };
}

test("validateOpenCodeReadOnlyCommandAgainstContract passes for compatible contract and command", () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract(),
    builtCommand: makeBuiltCommand()
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("validateOpenCodeReadOnlyCommandAgainstContract fails when run subcommand support is missing", () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract({ supportsRunSubcommand: false }),
    builtCommand: makeBuiltCommand()
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("run")));
});

test("validateOpenCodeReadOnlyCommandAgainstContract fails when model flag support is missing", () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract({ supportsModelFlag: false }),
    builtCommand: makeBuiltCommand()
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("--model")));
});

test("validateOpenCodeReadOnlyCommandAgainstContract fails when cwd flag support is missing", () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract({ supportsCwdFlag: false }),
    builtCommand: makeBuiltCommand()
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("--cwd")));
});

test("validateOpenCodeReadOnlyCommandAgainstContract fails when output flag support is missing", () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract({ supportsOutputFlag: false }),
    builtCommand: makeBuiltCommand()
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("--output")));
});

test('validateOpenCodeReadOnlyCommandAgainstContract fails when stdin marker "-" support is missing', () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract({ supportsStdinPrompt: false }),
    builtCommand: makeBuiltCommand()
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("stdin")));
});

test("validateOpenCodeReadOnlyCommandAgainstContract fails when executable name does not match contract", () => {
  const result = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: makeContract({ command: "opencode-stable" }),
    builtCommand: makeBuiltCommand({ command: "opencode" })
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("mismatch")));
});

test("buildAndValidateOpenCodeReadOnlyCommand returns both built command and validation", () => {
  const request: OpenCodeExecutionRequest = {
    prompt: "review this change",
    role: "reviewer",
    model: "anthropic/claude-sonnet-4.5",
    workspaceRoot: "/tmp/workspace",
    outputLastMessagePath: "/tmp/out.md",
    orchestratorRoot: "/tmp/orchestrator",
    dryRun: true
  };

  const result = buildAndValidateOpenCodeReadOnlyCommand({
    request,
    contract: makeContract()
  });

  assert.equal(result.command.command, "opencode");
  assert.equal(result.command.args[0], "run");
  assert.equal(result.validation.ok, true);
  assert.deepEqual(result.validation.errors, []);
});
