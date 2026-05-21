import type { EvidenceChecksSummary } from "./evidence-manifest.js";

export function createEvidenceChecksSummary(value: unknown): EvidenceChecksSummary {
  if (!value || typeof value !== "object") {
    return { status: "unknown", failed: [], skipped: [] };
  }

  const checks = value as {
    state?: unknown;
    failedChecks?: unknown;
    failures?: unknown;
    error?: unknown;
  };

  if (checks.state === "executed") {
    return { status: "passed", failed: [], skipped: [] };
  }

  if (checks.state === "failed") {
    return {
      status: "failed",
      failed: dedupeSort([
        ...coerceStringArray(checks.failedChecks),
        ...coerceStringArray(checks.failures),
        ...(typeof checks.error === "string" && checks.error.trim().length > 0 ? [checks.error.trim()] : [])
      ]),
      skipped: []
    };
  }

  if (typeof checks.state === "string" && (checks.state === "disabled" || checks.state.includes("skipped"))) {
    return { status: "skipped", failed: [], skipped: [checks.state] };
  }

  return { status: "unknown", failed: [], skipped: [] };
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
