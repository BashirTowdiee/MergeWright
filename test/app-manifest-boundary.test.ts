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

test("Web app manifest exposes its built entrypoints", async () => {
  const manifest = await readManifest("apps/web/package.json");

  assert.equal(manifest.main, "../../dist/apps/web/src/server.js");
  assert.equal(manifest.types, "../../dist/apps/web/src/server.d.ts");
  assert.equal(manifest.exports?.["."]?.types, "../../dist/apps/web/src/server.d.ts");
  assert.equal(manifest.exports?.["."]?.default, "../../dist/apps/web/src/server.js");
});
