import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

interface PackageJson {
  readonly bin?: Record<string, string>;
  readonly scripts?: Record<string, string>;
}

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as PackageJson;
}

test("package CLI entrypoints point at the app boundary", async () => {
  const packageJson = await readPackageJson();

  assert.equal(packageJson.bin?.mergewright, "dist/apps/cli/src/main.js");
  assert.equal(packageJson.scripts?.mergewright, "npm run build && node dist/apps/cli/src/main.js");
});
