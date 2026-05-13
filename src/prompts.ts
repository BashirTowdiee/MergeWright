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
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Template rendering failed: missing variable "${key}"`);
    }
    return variables[key];
  });
}
