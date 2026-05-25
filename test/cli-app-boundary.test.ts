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

test("root CLI module remains a compatibility boundary", async () => {
  const rootCli = await readFile(join(process.cwd(), "src/cli.ts"), "utf8");

  assert.equal(rootCli.startsWith("#!"), false);
  assert.equal(rootCli.includes("node:process"), false);
  assert.equal(rootCli.includes("node:child_process"), false);
  assert.equal(rootCli.includes("defaultOpenRunDirectory"), false);
  assert.equal(rootCli.includes("void main()"), false);
  assert.equal(rootCli.includes("export async function runCommand"), true);
});
