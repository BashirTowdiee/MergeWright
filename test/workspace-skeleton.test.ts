import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

interface PackageJson {
  readonly name?: string;
  readonly private?: boolean;
  readonly type?: string;
  readonly workspaces?: readonly string[];
  readonly scripts?: Record<string, string>;
}

interface TsConfigJson {
  readonly extends?: string;
  readonly compilerOptions?: {
    readonly rootDir?: string;
    readonly outDir?: string;
  };
  readonly include?: readonly string[];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(process.cwd(), path), "utf8")) as T;
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return readJson<PackageJson>(join(path, "package.json"));
}

test("root package declares npm workspace globs for apps and packages", async () => {
  const packageJson = await readJson<PackageJson>("package.json");

  assert.deepEqual(packageJson.workspaces, ["apps/*", "packages/*"]);
});

test("root package preserves current build and exposes app workspace build orchestration", async () => {
  const packageJson = await readJson<PackageJson>("package.json");

  assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.json");
  assert.equal(packageJson.scripts?.["build:apps"], "npm run build --workspaces --if-present --include-workspace-root=false");
});

test("TypeScript build includes workspace package sources", async () => {
  const tsconfig = await readJson<TsConfigJson>("tsconfig.json");

  assert.ok(tsconfig.include?.includes("apps/**/*.ts"));
  assert.ok(tsconfig.include?.includes("apps/**/*.tsx"));
  assert.ok(tsconfig.include?.includes("packages/**/*.ts"));
  assert.ok(tsconfig.include?.includes("packages/**/*.tsx"));
});

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

test("app workspace TypeScript configs extend the root config with app-local outputs", async () => {
  for (const appName of ["api", "cli", "web"] as const) {
    const tsconfig = await readJson<TsConfigJson>(`apps/${appName}/tsconfig.json`);

    assert.equal(tsconfig.extends, "../../tsconfig.json", `${appName} should extend the root tsconfig`);
    assert.equal(tsconfig.compilerOptions?.rootDir, "../..", `${appName} should compile from the repository root during migration`);
    assert.equal(tsconfig.compilerOptions?.outDir, `../../dist/apps/${appName}`, `${appName} should emit under its app dist folder`);
    assert.deepEqual(tsconfig.include, ["src/**/*.ts", "src/**/*.tsx"], `${appName} should include only app-local source files`);
  }
});

test("app workspace packages expose local build scripts", async () => {
  for (const appName of ["api", "cli", "web"] as const) {
    const packageJson = await readPackageJson(`apps/${appName}`);

    assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.json", `${appName} should build from its app-local tsconfig`);
  }
});
