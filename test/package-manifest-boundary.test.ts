import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

interface PackageManifest {
  readonly main?: string;
  readonly types?: string;
  readonly exports?: {
    readonly "."?: {
      readonly types?: string;
      readonly default?: string;
    };
  };
}

const packageNames = ["application", "domain", "adapters", "config", "shared"] as const;

async function readManifest(packageName: string): Promise<PackageManifest> {
  const content = await readFile(join(process.cwd(), "packages", packageName, "package.json"), "utf8");

  return JSON.parse(content) as PackageManifest;
}

test("workspace package manifests expose their built package entrypoints", async () => {
  for (const packageName of packageNames) {
    const manifest = await readManifest(packageName);
    const expectedJavaScript = `../../dist/packages/${packageName}/src/index.js`;
    const expectedTypes = `../../dist/packages/${packageName}/src/index.d.ts`;

    assert.equal(manifest.main, expectedJavaScript, `${packageName} should expose its built JavaScript entrypoint`);
    assert.equal(manifest.types, expectedTypes, `${packageName} should expose its built type declaration entrypoint`);
    assert.equal(manifest.exports?.["."]?.types, expectedTypes, `${packageName} should export its type declaration entrypoint`);
    assert.equal(manifest.exports?.["."]?.default, expectedJavaScript, `${packageName} should export its JavaScript entrypoint`);
  }
});
