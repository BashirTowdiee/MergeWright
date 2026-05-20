import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatChangeReportJson, formatChangeReportMarkdown } from "./change-report-formatters.js";
import { formatPrSummaryMarkdown } from "./pr-summary.js";
import type { ChangeReport } from "./change-report-types.js";

export async function writeChangeReport(input: { runDir: string; report: ChangeReport }): Promise<{
  markdownPath: string;
  jsonPath: string;
}> {
  const runDir = path.resolve(input.runDir);
  const markdownPath = resolveWithinRunDir(runDir, "run-report.md");
  const jsonPath = resolveWithinRunDir(runDir, "run-report.json");

  await mkdir(runDir, { recursive: true });
  await writeFile(markdownPath, formatChangeReportMarkdown(input.report), "utf8");
  await writeFile(jsonPath, formatChangeReportJson(input.report), "utf8");

  return { markdownPath, jsonPath };
}

export async function writePrSummary(input: { runDir: string; report: ChangeReport }): Promise<{ markdownPath: string }> {
  const runDir = path.resolve(input.runDir);
  const markdownPath = resolveWithinRunDir(runDir, "pr-summary.md");

  await mkdir(runDir, { recursive: true });
  await writeFile(markdownPath, formatPrSummaryMarkdown(input.report), "utf8");

  return { markdownPath };
}

function resolveWithinRunDir(runDir: string, filename: string): string {
  const resolved = path.resolve(runDir, filename);
  const relative = path.relative(runDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside run directory: ${runDir}`);
  }
  return resolved;
}
