export type ContinuePhase = "builder" | "reviewer" | "fixPlanning" | "fixExecution" | "checks";

export const ORDERED_PHASES: readonly ContinuePhase[] = ["builder", "reviewer", "fixPlanning", "fixExecution", "checks"];

export interface ContinuePhaseSelectionOptions {
  executeBuilder?: boolean;
  executeReviewer?: boolean;
  planFix?: boolean;
  executeFix?: boolean;
  runChecks?: boolean;
}

export function selectedPhases(options: ContinuePhaseSelectionOptions): ContinuePhase[] {
  const phases: ContinuePhase[] = [];
  if (options.executeBuilder) phases.push("builder");
  if (options.executeReviewer) phases.push("reviewer");
  if (options.planFix) phases.push("fixPlanning");
  if (options.executeFix) phases.push("fixExecution");
  if (options.runChecks) phases.push("checks");
  return phases;
}

export function assertContinuePhaseSelection(selected: readonly ContinuePhase[]): void {
  if (selected.length === 0) {
    throw new Error("continue-run requires at least one phase flag. Supported flags: --execute-builder, --execute-reviewer, --plan-fix, --execute-fix, --run-checks.");
  }
}

export function writeEnabledContinuationPhases(
  options: Pick<ContinuePhaseSelectionOptions, "executeBuilder" | "executeFix">
): Array<"builder" | "fix"> {
  return [
    ...(options.executeBuilder ? (["builder"] as const) : []),
    ...(options.executeFix ? (["fix"] as const) : [])
  ];
}

export function assertAllowWritesTargetsWriteEligiblePhase(
  allowWrites: boolean,
  writeEnabledPhases: readonly ("builder" | "fix")[]
): void {
  if (allowWrites && writeEnabledPhases.length === 0) {
    throw new Error("--allow-writes requires at least one write-eligible continuation phase: --execute-builder or --execute-fix.");
  }
}
