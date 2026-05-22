import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const TUI_ROOT = join(process.cwd(), "src", "tui");

const FORBIDDEN_IMPORTS = [
  "child_process",
  "node:child_process",
  "../cli.js",
  "../runner.js",
  "../codex.js",
  "../git.js",
  "../execution-backends/codex-cli-backend.js",
  "../execution-backends/opencode-cli-backend.js"
];

const FORBIDDEN_PATTERNS = [
  /from\s+["']node:fs["']/,
  /from\s+["']fs["']/,
  /from\s+["']node:fs\/promises["']/,
  /from\s+["']fs\/promises["']/,
  /require\(["']child_process["']\)/,
  /require\(["']node:child_process["']\)/
];

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(path);
      }
      if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        return [path];
      }
      return [];
    })
  );

  return files.flat();
}

test("TUI code does not import forbidden write or shell execution dependencies", async () => {
  const files = await listTypeScriptFiles(TUI_ROOT);
  assert.ok(files.length > 0, "expected TUI source files to be present");

  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relativePath = relative(process.cwd(), file);

    for (const forbiddenImport of FORBIDDEN_IMPORTS) {
      if (source.includes(`from "${forbiddenImport}"`) || source.includes(`from '${forbiddenImport}'`)) {
        violations.push(`${relativePath} imports ${forbiddenImport}`);
      }
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(source)) {
        violations.push(`${relativePath} matches ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
