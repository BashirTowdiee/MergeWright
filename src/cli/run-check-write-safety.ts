import { loadAndValidateConfig, resolveConfigPath } from "../config.js";
import { checkWriteSafety } from "../write-safety.js";
import { createGitInspectionClient, type GitInspectionClient } from "../git-inspection.js";
import { NOOP_PROGRESS_LOGGER, type ProgressLogger } from "../progress-logger.js";
import type { CheckWriteSafetyRunResult } from "./types.js";

export async function runCheckWriteSafety(
  configArg: string,
  orchestratorRoot: string,
  progressLogger: ProgressLogger = NOOP_PROGRESS_LOGGER,
  git: GitInspectionClient = createGitInspectionClient()
): Promise<CheckWriteSafetyRunResult> {
  progressLogger.phaseStart("write-safety", "loading config");
  const configPath = resolveConfigPath(orchestratorRoot, configArg);
  const config = await loadAndValidateConfig(configPath);
  progressLogger.phaseStart("write-safety", "inspecting git workspace");
  progressLogger.phaseStart("write-safety", "checking blocked paths");
  const result = await checkWriteSafety({
    workspaceRoot: config.workspaceRoot,
    config,
    git
  });
  if (result.ok) {
    progressLogger.phaseComplete("write-safety", "passed");
  } else {
    progressLogger.phaseFailed("write-safety", "write safety checks failed");
  }
  return {
    configPath,
    workspaceRoot: config.workspaceRoot,
    result
  };
}
