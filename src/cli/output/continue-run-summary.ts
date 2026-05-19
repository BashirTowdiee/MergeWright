import type { continueRun } from "../../continue-run.js";

export function formatContinueSummaryLines(result: Awaited<ReturnType<typeof continueRun>>): string[] {
  return [
    "Continuation summary",
    `- run id: ${result.runId}`,
    `- run directory: ${result.runDir}`,
    `- config path: ${result.configPath}`,
    `- selected continuation phases: ${result.selectedPhases.join(", ")}`,
    `- dry-run: ${result.dryRun}`,
    `- allowWrites: ${result.allowWrites}`,
    `- write safety: ${result.writeSafetyState}`,
    `- write-enabled phases selected: ${result.writeEnabledPhases.length > 0 ? result.writeEnabledPhases.join(", ") : "none"}`,
    `- phase statuses before: planner=${result.before.planner}, builder=${result.before.builder}, reviewer=${result.before.reviewer}, fixPlanning=${result.before.fixPlanning}, fixExecution=${result.before.fixExecution}, checks=${result.before.checks}`,
    `- phase statuses after: planner=${result.after.planner}, builder=${result.after.builder}, reviewer=${result.after.reviewer}, fixPlanning=${result.after.fixPlanning}, fixExecution=${result.after.fixExecution}, checks=${result.after.checks}`,
    `- fix execution skip due to PROCEED: ${result.skippedFixBecauseProceed}`,
    `- artefacts written: ${result.artefacts.length}`
  ];
}
