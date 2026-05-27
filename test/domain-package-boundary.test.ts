import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const boundaryPath = join(process.cwd(), "packages/domain/src/index.ts");

test("domain workspace boundary re-exports command policy and result codes", async () => {
  const source = await readFile(boundaryPath, "utf8");

  assert.ok(source.includes("APP_COMMAND_ERROR_CODES"));
  assert.ok(source.includes("type AppCommandErrorCode"));
  assert.ok(source.includes("COMMAND_RISKS"));
  assert.ok(source.includes("requiresConfirmationForRisk"));
  assert.ok(source.includes("type CommandRisk"));
  assert.ok(source.includes("../../../src/application/commands/app-command-error.js"));
  assert.ok(source.includes("../../../src/application/commands/command-risk.js"));
  assert.equal(source.includes("Package boundary placeholder"), false);
});
