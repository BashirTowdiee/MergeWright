import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunMetadata } from "./run-metadata.js";

export interface PlanHtmlRenderInput {
  runLabel: string;
  stageTitle: string;
  projectName?: string;
  workspaceRoot?: string;
  plannerSummary?: string;
  phaseFlow: string[];
  acceptanceCriteria?: string[];
  risks?: string[];
  assumptions?: string[];
  constraints?: string[];
  plannedCommands?: string[];
  artefactPaths: string[];
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPlanHtml(input: PlanHtmlRenderInput): string {
  const rows = (title: string, items: string[]): string =>
    items.length === 0
      ? `<section><h2>${escapeHtml(title)}</h2><p class="muted">Not available</p></section>`
      : `<section><h2>${escapeHtml(title)}</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;

  const plannerSummary = input.plannerSummary?.trim() || "Not available";
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>${escapeHtml(input.runLabel)} plan visualisation</title>`,
    "<style>",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f6f7f9;color:#0d1b2a;line-height:1.5}",
    "main{max-width:1000px;margin:0 auto;padding:24px}",
    "h1,h2{line-height:1.2}",
    ".card{background:#fff;border:1px solid #d8dee8;border-radius:10px;padding:16px;margin:0 0 16px 0}",
    ".muted{color:#516173}",
    "ul{margin:8px 0 0 20px;padding:0}",
    "code{background:#eef2f7;padding:2px 6px;border-radius:4px}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    `<section class="card"><h1>${escapeHtml(input.stageTitle)}</h1><p><strong>Run:</strong> <code>${escapeHtml(input.runLabel)}</code></p><p><strong>Project:</strong> ${escapeHtml(input.projectName ?? "Not available")}</p><p><strong>Target:</strong> ${escapeHtml(input.workspaceRoot ?? "Not available")}</p><p class="muted">This page is a visualisation only. Canonical plan artefacts remain the Markdown/JSON run files.</p></section>`,
    `<section class="card"><h2>Planner Summary</h2><p>${escapeHtml(plannerSummary)}</p></section>`,
    `<section class="card">${rows("Phase Flow", input.phaseFlow)}</section>`,
    `<section class="card">${rows("Acceptance Criteria", input.acceptanceCriteria ?? [])}</section>`,
    `<section class="card">${rows("Risks", input.risks ?? [])}${rows("Assumptions", input.assumptions ?? [])}${rows("Constraints", input.constraints ?? [])}</section>`,
    `<section class="card">${rows("Planned Commands", input.plannedCommands ?? [])}</section>`,
    `<section class="card">${rows("Artefact Paths", input.artefactPaths)}</section>`,
    "</main>",
    "</body>",
    "</html>"
  ].join("");
}

export async function writePlanHtmlFromRun(runDir: string, metadata: RunMetadata, artefactPaths: string[]): Promise<string> {
  const stageInstruction = await readOptional(path.resolve(runDir, "01-stage-input.md"));
  const plannerOutput = await readOptional(path.resolve(runDir, "06-planner-output-last-message.md"));
  const extractedBuilderPrompt = await readOptional(path.resolve(runDir, "builder-prompt.extracted.md"));
  const section = (names: string[]): string => readMarkdownSection(stageInstruction, names) || readMarkdownSection(plannerOutput, names);
  const plannerSummary = section(["planner summary", "summary"]) || firstParagraph(plannerOutput);
  const plannedCommands = extractCodeLines(extractedBuilderPrompt).slice(0, 50);
  const html = renderPlanHtml({
    runLabel: metadata.runId,
    stageTitle: metadata.stageName,
    projectName: metadata.projectName,
    workspaceRoot: metadata.workspaceRoot,
    plannerSummary,
    phaseFlow: phaseFlow(metadata),
    acceptanceCriteria: splitList(section(["acceptance criteria", "acceptance"])),
    risks: splitList(section(["risks", "risk"])),
    assumptions: splitList(section(["assumptions", "assumption"])),
    constraints: splitList(section(["constraints", "constraint"])),
    plannedCommands,
    artefactPaths: [...new Set(artefactPaths)].sort((a, b) => a.localeCompare(b))
  });
  const outputPath = path.resolve(runDir, "plan.html");
  await writeFile(outputPath, html, "utf8");
  return outputPath;
}

function phaseFlow(metadata: RunMetadata): string[] {
  const ordered: Array<keyof RunMetadata["phases"]> = ["planner", "builder", "reviewer", "fixPlanning", "fixExecution", "checks"];
  return ordered.map((name) => `${name}: ${metadata.phases[name]?.status ?? "unknown"}`);
}

function splitList(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-*]\s+/, ""));
}

function readMarkdownSection(markdown: string, names: string[]): string {
  if (!markdown) return "";
  const lines = markdown.split(/\r?\n/);
  const targets = new Set(names.map((name) => name.toLowerCase()));
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^#{1,6}\s+(.+)$/.exec(lines[i]);
    if (!match) continue;
    if (targets.has(match[1].trim().toLowerCase())) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";
  const captured: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (/^#{1,6}\s+/.test(lines[i])) break;
    captured.push(lines[i]);
  }
  return captured.join("\n").trim();
}

function extractCodeLines(value: string): string[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  return lines.filter((line) => line.startsWith("$ ") || line.startsWith("npm ") || line.startsWith("pnpm ") || line.startsWith("yarn "));
}

function firstParagraph(markdown: string): string {
  return markdown
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.length > 0 && !chunk.startsWith("#"))
    ?.replace(/\s+/g, " ")
    .slice(0, 500) ?? "";
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
