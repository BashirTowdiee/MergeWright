import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

interface PackageJson {
  readonly name?: string;
  readonly private?: boolean;
  readonly type?: string;
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(join(process.cwd(), path, "package.json"), "utf8")) as PackageJson;
}

test("workspace skeleton declares explicit app and package boundaries", async () => {
  const expectedPackages = new Map([
    ["apps/cli", "@mergewright/cli"],
    ["apps/api", "@mergewright/api"],
    ["apps/web", "@mergewright/web"],
    ["packages/application", "@mergewright/application"],
    ["packages/domain", "@mergewright/domain"],
    ["packages/adapters", "@mergewright/adapters"],
    ["packages/config", "@mergewright/config"],
    ["packages/shared", "@mergewright/shared"],
  ]);

  for (const [path, expectedName] of expectedPackages) {
    const packageJson = await readPackageJson(path);

    assert.equal(packageJson.name, expectedName, `${path} should use its workspace package name`);
    assert.equal(packageJson.private, true, `${path} should remain private during migration`);
    assert.equal(packageJson.type, "module", `${path} should match the root ESM module mode`);
  }
});
