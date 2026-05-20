import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, runCommand } from "../src/cli.js";

test("tui-spike command renders the framework-neutral TUI spike", async () => {
  const output: string[] = [];

  await runCommand(parseArgs(["tui-spike"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));

  const text = output.join("\n");
  assert.match(text, /MergeWright TUI spike/);
  assert.match(text, /Runs/);
  assert.match(text, /docs-site build/);
  assert.match(text, /Phase flow/);
  assert.match(text, /Reviewer/);
  assert.match(text, /Safe action/);
  assert.match(text, /Generate fix prompt/);
  assert.match(text, /Review findings/);
});

test("tui-spike rejects config and workspace flags", () => {
  assert.throws(() => parseArgs(["tui-spike", "--config", "configs/test.json"]), /does not accept --config/);
  assert.throws(() => parseArgs(["tui-spike", "--workspace", "/tmp/repo"]), /does not accept --config/);
});
