import type { RunDetailViewModel } from "./view-models.js";

export function buildRunContextLines(run: RunDetailViewModel): string[] {
  const readiness = run.readiness;
  const score = readiness?.score == null ? "unknown" : String(readiness.score);
  const risk = readiness?.risk ?? "unknown";
  const checksState = readiness?.checksState ?? "unknown";
  const reviewerVerdict = readiness?.reviewerVerdict ?? "UNKNOWN";
  const changedFileCount = readiness?.changedFileCount == null ? "unknown" : String(readiness.changedFileCount);
  const evidenceWarningCount = readiness?.missingEvidenceWarnings.length ?? 0;

  return [
    `Run: ${run.id}`,
    `Status: ${run.status}`,
    `Mode: ${run.mode}`,
    `Branch: ${run.branch ?? "unknown"}`,
    `Provider: ${formatProvider(run)}`,
    `Readiness: ${readiness?.status ?? "unknown"} (${readiness?.source ?? "fallback"})`,
    `Score/Risk: ${score}/100 · ${risk}`,
    `Checks: ${checksState}`,
    `Reviewer verdict: ${reviewerVerdict}`,
    `Changed files: ${changedFileCount}`,
    `Missing evidence warnings: ${evidenceWarningCount}`,
    `Run dir: ${run.runDir}`
  ];
}

function formatProvider(run: RunDetailViewModel): string {
  if (run.provider && run.model) {
    return `${run.provider} / ${run.model}`;
  }
  return run.provider ?? run.model ?? "unknown";
}
