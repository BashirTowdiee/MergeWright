import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TUI_ROOT = join(process.cwd(), "src", "tui");

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      files.push(path);
    }
  }

  return files;
}

function readTuiSources(): Array<{ readonly path: string; readonly content: string }> {
  return collectSourceFiles(TUI_ROOT).map((path) => ({ path, content: readFileSync(path, "utf8") }));
}

test("TUI does not import child_process", () => {
  for (const source of readTuiSources()) {
    assert.equal(source.content.includes("child_process"), false, `${source.path} imports child_process`);
  }
});

test("TUI does not use write-capable fs APIs", () => {
  const forbiddenPatterns = [
    /writeFile(Sync)?\s*\(/,
    /appendFile(Sync)?\s*\(/,
    /rm(Sync)?\s*\(/,
    /unlink(Sync)?\s*\(/,
    /mkdir(Sync)?\s*\(/,
    /rename(Sync)?\s*\(/,
    /copyFile(Sync)?\s*\(/,
    /createWriteStream\s*\(/
  ];

  for (const source of readTuiSources()) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(pattern.test(source.content), false, `${source.path} matches ${pattern}`);
    }
  }
});

test("TUI does not construct shell-shaped command execution", () => {
  const forbiddenPatterns = [
    /npm\s+run\s+agent/,
    /npm\s+run\s+mergewright/,
    /git\s+(commit|push|merge|checkout|switch)/,
    /codex\s+exec/,
    /spawn\s*\(/,
    /execFile\s*\(/,
    /exec\s*\(/
  ];

  for (const source of readTuiSources()) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(pattern.test(source.content), false, `${source.path} matches ${pattern}`);
    }
  }
});
