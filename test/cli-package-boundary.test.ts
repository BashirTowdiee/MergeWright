import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

interface Manifest {
  readonly main?: string;
  readonly bin?: Record<string, string>;
}

async function readManifest(path: string): Promise<Manifest> {
  return JSON.parse(await readFile(path, "utf8")) as Manifest;
}

test("CLI package exposes the mergewright binary entrypoint", async () => {
  const rootManifest = await readManifest("package.json");
  const cliManifest = await readManifest("apps/cli/package.json");

  assert.equal(rootManifest.bin?.mergewright, "dist/apps/cli/src/main.js");
  assert.equal(cliManifest.main, "../../dist/apps/cli/src/main.js");
  assert.equal(cliManifest.bin?.mergewright, "../../dist/apps/cli/src/main.js");
});
