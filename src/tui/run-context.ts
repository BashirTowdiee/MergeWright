import type { RunDetailViewModel } from "./view-models.js";

export function buildRunContextLines(run: RunDetailViewModel): string[] {
  return [
    `Run: ${run.id}`,
    `Status: ${run.status}`,
    `Mode: ${run.mode}`,
    `Branch: ${run.branch ?? "unknown"}`,
    `Provider: ${formatProvider(run)}`,
    `Run dir: ${run.runDir}`
  ];
}

function formatProvider(run: RunDetailViewModel): string {
  if (run.provider && run.model) {
    return `${run.provider} / ${run.model}`;
  }
  return run.provider ?? run.model ?? "unknown";
}
