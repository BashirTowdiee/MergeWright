import { dispatchCliCommand } from "./cli/dispatch.js";
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

  await dispatchCliCommand({
    command: args.command,
    helpText: renderHelpText(),
    context: {
      args,
      orchestratorRoot,
      platform,
      openRunDirectory,
      writeLine,
      deps,
      progressLogger
    }
  });
}
