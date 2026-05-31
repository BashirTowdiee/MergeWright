import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

interface Manifest {
  readonly main?: string;
  readonly types?: string;
  readonly exports?: {
    readonly "."?: {
      readonly types?: string;
      readonly default?: string;
    };
  };
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
}

async function readManifest(path: string): Promise<Manifest> {
  return JSON.parse(await readFile(path, "utf8")) as Manifest;
}

test("API app manifest exposes its built entrypoints", async () => {
  const manifest = await readManifest("apps/api/package.json");

  assert.equal(manifest.main, "../../dist/apps/api/src/server.js");
  assert.equal(manifest.types, "../../dist/apps/api/src/server.d.ts");
  assert.equal(manifest.exports?.["."]?.types, "../../dist/apps/api/src/server.d.ts");
  assert.equal(manifest.exports?.["."]?.default, "../../dist/apps/api/src/server.js");
});

test("CLI app manifest exposes its built entrypoints", async () => {
  const manifest = await readManifest("apps/cli/package.json");

  assert.equal(manifest.main, "../../dist/apps/cli/src/main.js");
  assert.equal(manifest.types, "../../dist/apps/cli/src/main.d.ts");
  assert.equal(manifest.exports?.["."]?.types, "../../dist/apps/cli/src/main.d.ts");
  assert.equal(manifest.exports?.["."]?.default, "../../dist/apps/cli/src/main.js");
});

test("Web app manifest exposes Next.js runtime scripts", async () => {
  const manifest = await readManifest("apps/web/package.json");

  assert.equal(manifest.scripts?.dev, "next dev --webpack --hostname 127.0.0.1 --port 3050");
  assert.equal(manifest.scripts?.build, "next build --webpack");
  assert.equal(manifest.scripts?.start, "next start --hostname 127.0.0.1 --port 3050");
  assert.ok(typeof manifest.dependencies?.next === "string");
});
