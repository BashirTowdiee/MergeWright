import type { ProgressLogger } from "../../progress-logger.js";

export type CodexPhaseName =
  | "planner"
  | "builder"
  | "reviewer"
  | "fix-planning"
  | "fix";

export async function runCodexPhase(input: {
  phase: CodexPhaseName;
  streamCodex: boolean;
  progressLogger: ProgressLogger;
  action: () => Promise<void>;
}): Promise<void> {
  if (!input.streamCodex) {
    await input.action();
    return;
  }

  input.progressLogger.codexStreamStart(input.phase);
  try {
    await input.action();
  } finally {
    input.progressLogger.codexStreamEnd(input.phase);
  }
}
