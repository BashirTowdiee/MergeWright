import { assertBoolean } from "../validation.js";

export function parseSafety(raw: Record<string, unknown>) {
  const manualCommit = assertBoolean(raw.manualCommit, "safety.manualCommit");
  if (!manualCommit) {
    throw new Error("Invalid config: safety.manualCommit must be true for this workflow");
  }

  const forbidAutoCommit = assertBoolean(raw.forbidAutoCommit, "safety.forbidAutoCommit");
  if (!forbidAutoCommit) {
    throw new Error("Invalid config: safety.forbidAutoCommit must be true");
  }

  const forbidAutoPush = assertBoolean(raw.forbidAutoPush, "safety.forbidAutoPush");
  if (!forbidAutoPush) {
    throw new Error("Invalid config: safety.forbidAutoPush must be true");
  }

  return {
    requireGitRepo: assertBoolean(raw.requireGitRepo, "safety.requireGitRepo"),
    requireCleanStart: assertBoolean(raw.requireCleanStart, "safety.requireCleanStart"),
    manualCommit: true as const,
    forbidAutoCommit: true as const,
    forbidAutoPush: true as const
  };
}
