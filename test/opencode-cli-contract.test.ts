import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  probeOpenCodeCliContract,
  validateOpenCodeProbeCommand
} from "../src/execution-backends/opencode-cli-contract.js";

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

  const result = await probeOpenCodeCliContract({ command: fake.command, env: envWithPath(fake.binDir) });

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

  const result = await probeOpenCodeCliContract({ command: fake.command, env: envWithPath(fake.binDir) });

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

  const result = await probeOpenCodeCliContract({ command: fake.command, env: envWithPath(fake.binDir) });

  assert.equal(result.ok, true);
  const calls = (await readFile(fake.logPath, "utf8")).trim().split("\n").sort();
  assert.deepEqual(calls, ["--help", "--version", "run --help"].sort());
  assert.ok(calls.every((call) => call !== "run" && !call.includes("--output")));
});
