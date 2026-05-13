import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("package.json includes required v1 scripts", async () => {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
    description?: string;
    bin?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  assert.ok(pkg.name);
  assert.ok(pkg.version);
  assert.ok(pkg.description);
  assert.ok(pkg.bin && Object.keys(pkg.bin).length > 0);
  assert.equal(typeof pkg.scripts?.build, "string");
  assert.equal(typeof pkg.scripts?.test, "string");
  assert.equal(typeof pkg.scripts?.agent, "string");
});

test(".gitignore retains required ignore and keep rules", async () => {
  const ignore = await readFile(path.join(repoRoot, ".gitignore"), "utf8");
  assert.match(ignore, /(^|\n)node_modules\/(\n|$)/);
  assert.match(ignore, /(^|\n)dist\/(\n|$)/);
  assert.match(ignore, /(^|\n)runs\/\*(\n|$)/);
  assert.match(ignore, /(^|\n)!runs\/\.gitkeep(\n|$)/);
  assert.match(ignore, /(^|\n)\.env(\n|$)/);
  assert.match(ignore, /(^|\n)\*\.log(\n|$)/);
});
