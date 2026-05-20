import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, runCommand } from "../src/cli.js";

test("tui command renders the dependency-free TUI preview shell", async () => {
  const output: string[] = [];

  await runCommand(parseArgs(["tui"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));

  const text = output.join("\n");
  assert.match(text, /MergeWright TUI preview/);
  assert.match(text, /Framework: pending Ink vs OpenTUI\/Solid decision/);
  assert.match(text, /Mode: read-only preview fixture/);
  assert.match(text, /Shepherds-Staff TUI spike/);
  assert.match(text, /Runs/);
  assert.match(text, /Phase flow/);
  assert.match(text, /Safe action/);
  assert.match(text, /Review findings/);
});

test("tui command rejects config, repo, and workspace flags", () => {
  assert.throws(() => parseArgs(["tui", "--config", "configs/test.json"]), /tui does not accept --config/);
  assert.throws(() => parseArgs(["tui", "--repo", "/tmp/repo"]), /tui does not accept --config/);
  assert.throws(() => parseArgs(["tui", "--workspace", "/tmp/repo"]), /tui does not accept --config/);
});
