import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const boundaryPath = join(process.cwd(), "packages/adapters/src/index.ts");

test("adapters workspace boundary re-exports process-bound adapters", async () => {
  const source = await readFile(boundaryPath, "utf8");

  assert.match(source, /export \* from "\.\/open-run-directory\.js";/);
  assert.doesNotMatch(source, /Package boundary placeholder/);
});
