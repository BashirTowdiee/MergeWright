import { readFile } from "node:fs/promises";
import type { OrchestratorConfig } from "./types.js";
import { validateConfig } from "./validate-config.js";

export async function loadAndValidateConfig(configPath: string): Promise<OrchestratorConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Config file not found or unreadable at ${configPath}. No fallback is used. ${msg}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid config JSON at ${configPath}: ${msg}`);
  }

  return validateConfig(json);
}
