import type { PipelinePreset } from "../../presets.js";
import type { SummaryResult } from "../types.js";

export function formatSummaryLines(
  result: SummaryResult,
  preset: PipelinePreset | undefined,
  executePlanner: boolean,
  executeBuilder: boolean,
  executeReviewer: boolean,
  planFix: boolean,
  executeFix: boolean,
  runChecks: boolean,
  allowWrites: boolean,
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run",
  writeEnabledPhases: Array<"builder" | "fix">
): string[] {
  const lines = [
    "Run summary",
    `- stage name: ${result.stageName}`,
    `- orchestrator root: ${result.orchestratorRoot}`,
    `- target workspace root: ${result.targetWorkspaceRoot}`,
    `- config path: ${result.configPath}`,
    `- run directory: ${result.runDir}`,
    `- preset: ${preset ?? "none"}`,
    `- resolved execution flags: executePlanner=${executePlanner}, executeBuilder=${executeBuilder}, executeReviewer=${executeReviewer}, planFix=${planFix}, executeFix=${executeFix}, runChecks=${runChecks}, dryRun=${result.dryRun}, allowWrites=${allowWrites}`,
    `- write safety: ${writeSafetyState}`,
    `- write-enabled phases selected: ${writeEnabledPhases.length > 0 ? writeEnabledPhases.join(", ") : "none"}`,
    "- artefacts written:"
  ];

  for (const artefact of result.artefacts) {
    lines.push(`  - ${artefact}`);
  }

  const plannerState = !executePlanner ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  const builderState = !executeBuilder ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  const reviewerState = !executeReviewer ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  const fixPlanningState = !planFix ? "disabled" : result.dryRun ? "skipped by dry-run" : "executed";
  let fixExecutionState = "disabled";
  if (executeFix) {
    if (result.dryRun) {
      fixExecutionState = "skipped by dry-run";
    } else if (result.artefacts.some((artefact) => artefact.endsWith("fix-exit.json"))) {
      fixExecutionState = "executed";
    } else if (result.artefacts.some((artefact) => artefact.endsWith("fix-skipped.json"))) {
      const skippedBecauseProceed = result.artefacts.some((artefact) => artefact.endsWith("review-to-fix-decision.proceed.json"));
      fixExecutionState = skippedBecauseProceed ? "skipped because proceed" : "disabled";
    }
  } else if (!result.dryRun && result.artefacts.some((artefact) => artefact.endsWith("fix-skipped.json"))) {
    fixExecutionState = "disabled";
  }

  lines.push(`- planner execution: ${plannerState}`);
  lines.push(`- builder execution: ${builderState}`);
  lines.push(`- reviewer execution: ${reviewerState}`);
  lines.push(`- fix planning: ${fixPlanningState}`);
  lines.push(`- fix execution: ${fixExecutionState}`);
  const checksState = !runChecks ? "disabled" : result.checksState;
  lines.push(`- target checks: ${checksState}`);
  if (result.dryRun && allowWrites && writeEnabledPhases.length > 0 && !executeReviewer) {
    lines.push("- post-write review: would be required when writes execute (add --execute-reviewer).");
  }
  lines.push("- note: planner/reviewer/review-to-fix remain read-only; git mutation/commit/push remains disabled.");

  return lines;
}
