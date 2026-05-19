import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { readStagePlan, writeStagePlan } from "../../stage-plan-store.js";
import { renderStagePlanMarkdown } from "../../stage-plan-renderer.js";
import type { CommandHandler } from "../command-context.js";
import { pathExists } from "../command-helpers.js";

export const handleImportStagePlanCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  if (!args.importFrom) {
    throw new Error("import-stage-plan requires --from <path>. Usage: agent-stage import-stage-plan --from <path> --out <path> [--force]");
  }
  if (!args.importOut) {
    throw new Error("import-stage-plan requires --out <path>. Usage: agent-stage import-stage-plan --from <path> --out <path> [--force]");
  }

  const sourcePath = path.resolve(orchestratorRoot, args.importFrom);
  const outputDir = path.resolve(orchestratorRoot, args.importOut);
  const jsonOutputPath = path.join(outputDir, "stage-plan.json");
  const markdownOutputPath = path.join(outputDir, "stage-plan.md");

  if (!args.force) {
    if (await pathExists(jsonOutputPath)) {
      throw new Error(`Output file already exists: ${jsonOutputPath}. Use --force to overwrite.`);
    }
    if (await pathExists(markdownOutputPath)) {
      throw new Error(`Output file already exists: ${markdownOutputPath}. Use --force to overwrite.`);
    }
  }

  const plan = await readStagePlan(sourcePath);
  await mkdir(outputDir, { recursive: true });
  await writeStagePlan(jsonOutputPath, plan);
  await writeFile(markdownOutputPath, renderStagePlanMarkdown(plan), "utf8");

  writeLine(`Imported stage plan: ${plan.title}`);
  writeLine(`Stages: ${plan.stages.length}`);
  writeLine(`JSON: ${jsonOutputPath}`);
  writeLine(`Markdown: ${markdownOutputPath}`);
};
