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

const REVIEWER_TEMPLATE_MARKERS = ["You are reviewing a Shepherd-Staff stage implementation", "json reviewer-verdict"];

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

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Template rendering failed: missing variable "${key}"`);
    }
    const value = variables[key];
    const budget = isReviewerTemplate ? REVIEWER_VARIABLE_BUDGETS[key] : undefined;
    return typeof budget === "number" ? truncateMiddle(value, budget) : value;
  });
}

export function truncateMiddle(value: string, maxChars: number): string {
  if (maxChars < 1) {
    throw new Error("truncateMiddle maxChars must be greater than 0");
  }
  if (value.length <= maxChars) {
    return value;
  }

  const marker = `\n\n[truncated: original length ${value.length} chars, retained ${maxChars} chars]\n\n`;
  if (marker.length >= maxChars) {
    return marker.slice(0, maxChars);
  }

  const remaining = maxChars - marker.length;
  const head = Math.ceil(remaining * 0.6);
  const tail = remaining - head;
  return `${value.slice(0, head)}${marker}${tail > 0 ? value.slice(-tail) : ""}`;
}
