import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

test("open-run directory process integration lives in adapters package", async () => {
  const adapter = await readFile(join(process.cwd(), "packages/adapters/src/open-run-directory.ts"), "utf8");
  const cliEntrypoint = await readFile(join(process.cwd(), "apps/cli/src/main.ts"), "utf8");

  assert.equal(adapter.includes("node:child_process"), true);
  assert.equal(adapter.includes("spawn(\"open\""), true);
  assert.equal(cliEntrypoint.includes("node:child_process"), false);
  assert.equal(cliEntrypoint.includes("spawn(\"open\""), false);
});
