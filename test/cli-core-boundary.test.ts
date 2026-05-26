import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

test("cli core remains a compatibility facade", async () => {
  const source = await readFile(join(process.cwd(), "src/cli-core.ts"), "utf8");

  assert.match(source, /export \{ runCommand \} from "\.\/cli\/run-command\.js";/);
  assert.equal(source.includes("dispatchCliCommand"), false);
  assert.equal(source.includes("createCliProgressLogger"), false);
  assert.equal(source.includes("async function runCommand"), false);
});
