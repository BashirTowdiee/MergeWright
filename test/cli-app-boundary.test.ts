import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

test("CLI app entrypoint owns the open-run adapter dependency", async () => {
  const entrypoint = await readFile(join(process.cwd(), "apps/cli/src/main.ts"), "utf8");

  assert.equal(entrypoint.includes("defaultOpenRunDirectory"), false);
  assert.equal(entrypoint.includes("const openRunDirectory"), true);
  assert.equal(entrypoint.includes("node:child_process"), true);
});
