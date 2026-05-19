import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_PROMPT_FILES = [
  "planner-stage.md",
  "reviewer.md",
  "review-to-fix.md",
  "final-review.md"
] as const;

export type PromptFileName = (typeof REQUIRED_PROMPT_FILES)[number];

export type TemplateVariables = Record<string, string>;

export const DEFAULT_REVIEWER_PROMPT_MAX_CHARS = 900_000;

const REVIEWER_TEMPLATE_MARKERS = ["You are reviewing a Shepherd-Staff stage implementation", "json reviewer-verdict"];
const PLACEHOLDER_PREFIX = "[placeholder:";

const REVIEWER_VARIABLE_BUDGETS: Record<string, number> = {
  stage_instruction: 80_000,
  planner_output: 60_000,
  extracted_builder_prompt: 60_000,
  builder_output: 90_000,
  builder_exit: 10_000,
  write_audit_context: 80_000,
  test_output: 80_000,
  git_diff: 200_000,
  git_status: 20_000
};

export interface ReviewerPromptBudgetSection {
  name: string;
  originalChars: number;
  retainedChars: number;
  truncated: boolean;
  budgetChars?: number;
}

export interface ReviewerPromptBudgetMetadata {
  maxChars: number;
  finalChars: number;
  exceedsBudget: boolean;
  sections: ReviewerPromptBudgetSection[];
}

export async function loadPromptTemplates(promptsDir: string): Promise<Record<PromptFileName, string>> {
  const result: Partial<Record<PromptFileName, string>> = {};

  for (const fileName of REQUIRED_PROMPT_FILES) {
    const fullPath = path.resolve(promptsDir, fileName);
    try {
      result[fileName] = await readFile(fullPath, "utf8");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Missing prompt template: ${fullPath}. ${msg}`);
    }
  }

  return result as Record<PromptFileName, string>;
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  const isReviewerTemplate = REVIEWER_TEMPLATE_MARKERS.every((marker) => template.includes(marker));
  const reviewerVariables = isReviewerTemplate ? enrichReviewerEvidenceVariables(variables) : variables;
  const sections: ReviewerPromptBudgetSection[] = [];

  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in reviewerVariables)) {
      throw new Error(`Template rendering failed: missing variable "${key}"`);
    }
    const value = reviewerVariables[key];
    const budget = isReviewerTemplate ? REVIEWER_VARIABLE_BUDGETS[key] : undefined;
    if (typeof budget !== "number") {
      return value;
    }

    const truncated = truncateMiddleWithMetadata(value, budget);
    sections.push({
      name: key,
      originalChars: value.length,
      retainedChars: truncated.value.length,
      truncated: truncated.truncated,
      budgetChars: budget
    });
    return truncated.value;
  });

  if (!isReviewerTemplate) {
    return rendered;
  }

  const metadata: ReviewerPromptBudgetMetadata = {
    maxChars: DEFAULT_REVIEWER_PROMPT_MAX_CHARS,
    finalChars: rendered.length,
    exceedsBudget: rendered.length > DEFAULT_REVIEWER_PROMPT_MAX_CHARS,
    sections
  };
  writeReviewerPromptBudgetArtefact(reviewerVariables.run_dir, metadata);

  if (metadata.exceedsBudget) {
    throw new Error(
      `Reviewer prompt exceeds configured budget after truncation. Final length: ${metadata.finalChars} chars. Budget: ${metadata.maxChars} chars. Try splitting the stage or reducing diff/test output.`
    );
  }

  return rendered;
}

export function truncateMiddle(value: string, maxChars: number): string {
  return truncateMiddleWithMetadata(value, maxChars).value;
}

function truncateMiddleWithMetadata(value: string, maxChars: number): { value: string; truncated: boolean } {
  if (maxChars < 1) {
    throw new Error("truncateMiddle maxChars must be greater than 0");
  }
  if (value.length <= maxChars) {
    return { value, truncated: false };
  }

  const marker = `\n\n[truncated: original length ${value.length} chars, retained ${maxChars} chars]\n\n`;
  if (marker.length >= maxChars) {
    return { value: marker.slice(0, maxChars), truncated: true };
  }

  const remaining = maxChars - marker.length;
  const head = Math.ceil(remaining * 0.6);
  const tail = remaining - head;
  return {
    value: `${value.slice(0, head)}${marker}${tail > 0 ? value.slice(-tail) : ""}`,
    truncated: true
  };
}

function enrichReviewerEvidenceVariables(variables: TemplateVariables): TemplateVariables {
  const runDir = variables.run_dir;
  if (!runDir) {
    return variables;
  }

  return {
    ...variables,
    git_diff: shouldReplacePlaceholder(variables.git_diff) ? collectRunEvidence(runDir, [".patch", "diff-stat.txt"]) : variables.git_diff,
    test_output: shouldReplacePlaceholder(variables.test_output) ? collectRunEvidence(runDir, ["-stdout.log", "-stderr.log", "checks-status.json"]) : variables.test_output,
    git_status: shouldReplacePlaceholder(variables.git_status) ? collectRunEvidence(runDir, ["summary.json"]) : variables.git_status
  };
}

function shouldReplacePlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith(PLACEHOLDER_PREFIX);
}

function collectRunEvidence(runDir: string, suffixes: string[]): string {
  if (!existsSync(runDir)) {
    return `[not available: run directory does not exist: ${runDir}]`;
  }

  const files = listFiles(runDir)
    .map((filePath) => path.relative(runDir, filePath))
    .filter((relativePath) => suffixes.some((suffix) => relativePath.endsWith(suffix)))
    .filter((relativePath) => !relativePath.endsWith("reviewer-stdout.log") && !relativePath.endsWith("reviewer-stderr.log"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    return `[not available: no matching run artefacts found for ${suffixes.join(", ")}]`;
  }

  return files
    .map((relativePath) => {
      const fullPath = path.resolve(runDir, relativePath);
      return [`## ${relativePath}`, readFileSync(fullPath, "utf8")].join("\n\n");
    })
    .join("\n\n---\n\n");
}

function listFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const fullPath = path.resolve(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath));
    } else if (entry.isFile() && statSync(fullPath).size > 0) {
      result.push(fullPath);
    }
  }
  return result;
}

function writeReviewerPromptBudgetArtefact(runDir: string | undefined, metadata: ReviewerPromptBudgetMetadata): void {
  if (!runDir) {
    return;
  }

  const filePath = path.resolve(runDir, "reviewer-prompt-budget.json");
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}
