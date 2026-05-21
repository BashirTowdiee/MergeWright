import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "../src/cli.js";

test("parseArgs parses backfill-evidence run id and config", () => {
  const parsed = parseArgs(["backfill-evidence", "run-123", "--config", "configs/project.json"]);

  assert.equal(parsed.command, "backfill-evidence");
  assert.equal(parsed.runId, "run-123");
  assert.equal(parsed.configArg, "configs/project.json");
  assert.equal(parsed.dryRun, false);
});

test("parseArgs supports dry-run for backfill-evidence", () => {
  const parsed = parseArgs(["backfill-evidence", "run-123", "--config", "configs/project.json", "--dry-run"]);

  assert.equal(parsed.command, "backfill-evidence");
  assert.equal(parsed.runId, "run-123");
  assert.equal(parsed.configArg, "configs/project.json");
  assert.equal(parsed.dryRun, true);
});
