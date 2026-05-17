import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StagePlan } from "./stage-plan.js";
import { parseStagePlanJson, serialiseStagePlan } from "./stage-plan-schema.js";

export async function readStagePlan(filePath: string): Promise<StagePlan> {
  let json: string;
  try {
    json = await readFile(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read stage plan file "${filePath}": ${message}`);
  }

  try {
    return parseStagePlanJson(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid stage plan file "${filePath}": ${message}`);
  }
}

export async function writeStagePlan(filePath: string, plan: StagePlan): Promise<void> {
  const output = serialiseStagePlan(plan);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, output, "utf8");
}
