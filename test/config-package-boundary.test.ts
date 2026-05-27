import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const boundaryPath = join(process.cwd(), "packages/config/src/index.ts");

test("config workspace boundary re-exports config loading and validation", async () => {
  const source = await readFile(boundaryPath, "utf8");

  assert.match(source, /export \{ loadAndValidateConfig \} from "\.\.\/\.\.\/\.\.\/src\/config\/load-config\.js";/);
  assert.match(source, /export \{ validateConfig \} from "\.\.\/\.\.\/\.\.\/src\/config\/validate-config\.js";/);
  assert.match(source, /export type \{ OrchestratorConfig \} from "\.\.\/\.\.\/\.\.\/src\/config\/types\.js";/);
  assert.doesNotMatch(source, /Package boundary placeholder/);
});
