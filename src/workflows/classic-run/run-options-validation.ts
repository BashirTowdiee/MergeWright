import type { RunOptions } from "../../runner.js";

export function validateRunOptions(options: RunOptions): void {
  if ((options.executeBuilder ?? false) && !(options.executePlanner ?? false)) {
    throw new Error("--execute-builder requires --execute-planner");
  }
  if ((options.executeReviewer ?? false) && !(options.executePlanner ?? false)) {
    throw new Error("--execute-reviewer requires --execute-planner");
  }
  if ((options.planFix ?? false) && !(options.executeReviewer ?? false)) {
    throw new Error("--plan-fix requires --execute-reviewer");
  }
  if ((options.executeFix ?? false) && !(options.planFix ?? false)) {
    throw new Error("--execute-fix requires --plan-fix");
  }
  if ((options.allowWrites ?? false) && !(options.executeBuilder ?? false) && !(options.executeFix ?? false)) {
    throw new Error("--allow-writes requires --execute-builder or --execute-fix.");
  }
  if (
    (options.allowWrites ?? false) &&
    ((options.executeBuilder ?? false) || (options.executeFix ?? false)) &&
    !(options.executeReviewer ?? false) &&
    !options.dryRun
  ) {
    throw new Error("--allow-writes requires --execute-reviewer for post-write review");
  }
}
