import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const boundaryPath = join(process.cwd(), "packages/shared/src/index.ts");

const expectedExports = [
  "./result.js",
  "type Result",
  "ok",
  "err",
  "isOk",
  "isErr",
  "./ids.js",
  "type Brand",
  "type RunId",
  "asRunId",
  "type TaskId",
  "asTaskId",
  "type ArtifactId",
  "asArtifactId",
  "./errors.js",
  "type SharedError",
  "sharedError"
];

test("shared workspace boundary re-exports cross-cutting primitives explicitly", async () => {
  const source = await readFile(boundaryPath, "utf8");

  assert.equal(source.includes("Package boundary placeholder"), false);

  for (const expectedExport of expectedExports) {
    assert.equal(
      source.includes(expectedExport),
      true,
      `Expected packages/shared/src/index.ts to export ${expectedExport}`
    );
  }
});
