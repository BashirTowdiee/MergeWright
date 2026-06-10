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
    readonly noEmit?: boolean;
  };
  readonly include?: readonly string[];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(process.cwd(), path), "utf8")) as T;
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return readJson<PackageJson>(join(path, "package.json"));
}

const appWorkspaces = ["api", "cli", "mcp", "web"] as const;
const packageWorkspaces = ["application", "domain", "adapters", "config", "shared"] as const;

test("root package declares npm workspace globs for apps and packages", async () => {
  const packageJson = await readJson<PackageJson>("package.json");

  assert.deepEqual(packageJson.workspaces, ["apps/*", "packages/*"]);
});

test("root package preserves current build and exposes workspace build orchestration", async () => {
  const packageJson = await readJson<PackageJson>("package.json");

  assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.json");
  assert.equal(packageJson.scripts?.["build:apps"], "npm run build --workspaces --if-present --include-workspace-root=false");
  assert.equal(
    packageJson.scripts?.["build:packages"],
    "npm run build --workspaces --if-present --include-workspace-root=false --workspace packages/*"
  );
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
    ["apps/mcp", "@mergewright/mcp"],
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
  for (const appName of appWorkspaces) {
    const tsconfig = await readJson<TsConfigJson>(`apps/${appName}/tsconfig.json`);

    assert.equal(tsconfig.extends, "../../tsconfig.json", `${appName} should extend the root tsconfig`);
    if (appName === "web") {
      assert.equal(tsconfig.compilerOptions?.noEmit, true, "web should use Next.js type-checking without root tsc emission");
      assert.deepEqual(tsconfig.include, ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx"]);
      continue;
    }
    assert.equal(tsconfig.compilerOptions?.rootDir, "../..", `${appName} should compile from the repository root during migration`);
    assert.equal(tsconfig.compilerOptions?.outDir, `../../dist/apps/${appName}`, `${appName} should emit under its app dist folder`);
    assert.deepEqual(tsconfig.include, ["src/**/*.ts", "src/**/*.tsx"], `${appName} should include only app-local source files`);
  }
});

test("package workspace TypeScript configs extend the root config with package-local outputs", async () => {
  for (const packageName of packageWorkspaces) {
    const tsconfig = await readJson<TsConfigJson>(`packages/${packageName}/tsconfig.json`);

    assert.equal(tsconfig.extends, "../../tsconfig.json", `${packageName} should extend the root tsconfig`);
    assert.equal(tsconfig.compilerOptions?.rootDir, "../..", `${packageName} should compile from the repository root during migration`);
    assert.equal(
      tsconfig.compilerOptions?.outDir,
      `../../dist/packages/${packageName}`,
      `${packageName} should emit under its package dist folder`
    );
    assert.deepEqual(
      tsconfig.include,
      ["src/**/*.ts", "src/**/*.tsx"],
      `${packageName} should include only package-local source files`
    );
  }
});

test("app workspace packages expose local build scripts", async () => {
  for (const appName of appWorkspaces) {
    const packageJson = await readPackageJson(`apps/${appName}`);

    if (appName === "web") {
      assert.equal(packageJson.scripts?.build, "next build --webpack");
      assert.equal(packageJson.scripts?.dev, "next dev --webpack --hostname 127.0.0.1 --port 3050");
      assert.equal(packageJson.scripts?.start, "next start --hostname 127.0.0.1 --port 3050");
      continue;
    }
    assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.json", `${appName} should build from its app-local tsconfig`);
  }
});

test("package workspace packages expose local build scripts", async () => {
  for (const packageName of packageWorkspaces) {
    const packageJson = await readPackageJson(`packages/${packageName}`);

    assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.json", `${packageName} should build from its package-local tsconfig`);
  }
});
