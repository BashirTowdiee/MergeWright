import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

test("CLI app entrypoint delegates open-run behaviour to adapters", async () => {
  const entrypoint = await readFile(join(process.cwd(), "apps/cli/src/main.ts"), "utf8");

  assert.equal(entrypoint.includes("../../../packages/adapters/src/open-run-directory.js"), true);
  assert.equal(entrypoint.includes("const openRunDirectory"), false);
  assert.equal(entrypoint.includes("node:child_process"), false);
});

test("root CLI module remains a compatibility boundary", async () => {
  const rootCli = await readFile(join(process.cwd(), "src/cli.ts"), "utf8");

  assert.equal(rootCli.startsWith("#!"), false);
  assert.equal(rootCli.includes("node:process"), false);
  assert.equal(rootCli.includes("node:child_process"), false);
  assert.equal(rootCli.includes("defaultOpenRunDirectory"), false);
  assert.equal(rootCli.includes("void main()"), false);
  assert.equal(rootCli.trim(), 'export * from "./cli-core.js";');
});
