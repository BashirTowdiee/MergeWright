import { commandHandlers } from "./cli/command-registry.js";
import { knownCommands } from "./cli/known-commands.js";
import { renderHelpText } from "./cli/output/help-text.js";
import { createCliProgressLogger } from "./cli/output/progress-log-policy.js";
import { runCheckWriteSafety as runCheckWriteSafetyImpl } from "./cli/run-check-write-safety.js";
import type { ParsedArgs, RunCommandDeps, OpenRunDirectory } from "./cli/types.js";

export type { ParsedArgs, RunCommandDeps, OpenRunDirectory, CheckWriteSafetyRunResult } from "./cli/types.js";
export const runCheckWriteSafety = runCheckWriteSafetyImpl;
export { formatSummaryLines } from "./cli/output/run-summary.js";
export { formatContinueSummaryLines } from "./cli/output/continue-run-summary.js";
export { formatInitProjectSummaryLines } from "./cli/output/init-project-summary.js";
export { formatWriteSafetySummaryLines } from "./cli/output/write-safety-summary.js";
export { formatRunDetailsLines } from "./cli/output/run-details-summary.js";
export { formatReportSummaryLines, formatGeneratedReportSummaryLines } from "./cli/output/report-summary.js";
export { parseArgs } from "./cli/parse/parse-args.js";

export async function runCommand(
  args: ParsedArgs,
  orchestratorRoot: string,
  platform: NodeJS.Platform,
  openRunDirectory: OpenRunDirectory,
  writeLine: (line: string) => void = console.log,
  deps: RunCommandDeps = {}
): Promise<void> {
  const progressLogger = createCliProgressLogger(args, writeLine);

  if (args.help) {
    writeLine(renderHelpText(args.command));
    return;
  }

  if (!args.command) {
    throw new Error(`Missing command.\n\n${renderHelpText()}`);
  }

  if (!knownCommands.has(args.command)) {
    throw new Error(`Unknown command: ${args.command}\n\n${renderHelpText()}`);
  }

  const handler = commandHandlers[args.command as keyof typeof commandHandlers];
  await handler({
    args,
    orchestratorRoot,
    platform,
    openRunDirectory,
    writeLine,
    deps,
    progressLogger
  });
}
