import type { RunMetadata } from "../../run-metadata.js";

export function buildWriteAuditContext(metadata: RunMetadata): string {
  const phases: string[] = [];
  if (metadata.writeAudit?.builder?.status === "captured") phases.push("builder");
  if (metadata.writeAudit?.fix?.status === "captured") phases.push("fix");
  if (phases.length === 0) {
    return "No write-audit artefacts available for reviewer context.";
  }
  const changedFiles = Array.from(
    new Set([...(metadata.writeAudit?.builder?.changedFiles ?? []), ...(metadata.writeAudit?.fix?.changedFiles ?? [])])
  ).sort((a, b) => a.localeCompare(b));
  const artefacts = Array.from(
    new Set([...(metadata.writeAudit?.builder?.artefacts ?? []), ...(metadata.writeAudit?.fix?.artefacts ?? [])])
  ).sort((a, b) => a.localeCompare(b));
  const matching = (suffix: string): string[] => artefacts.filter((artefact) => artefact.endsWith(suffix));
  const summaries = matching("/summary.json");
  const diffStats = artefacts.filter((artefact) => artefact.endsWith("/pre-diff-stat.txt") || artefact.endsWith("/post-diff-stat.txt"));
  const patches = artefacts.filter((artefact) => artefact.endsWith("/pre-diff.patch") || artefact.endsWith("/post-diff.patch"));
  return [
    `Write-enabled phases executed: ${phases.join(", ")}`,
    `Changed files from write audit: ${changedFiles.length > 0 ? changedFiles.join(", ") : "[none]"}`,
    `Write-audit summary paths: ${summaries.length > 0 ? summaries.join(", ") : "[none]"}`,
    `Write-audit diff-stat paths: ${diffStats.length > 0 ? diffStats.join(", ") : "[none]"}`,
    `Write-audit patch paths: ${patches.length > 0 ? patches.join(", ") : "[none]"}`,
    `All write-audit artefacts: ${artefacts.length > 0 ? artefacts.join(", ") : "[none]"}`,
    "Reviewer must inspect write-enabled changes using these artefacts."
  ].join("\n");
}
