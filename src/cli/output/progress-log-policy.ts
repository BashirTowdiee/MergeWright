import { createProgressLogger, NOOP_PROGRESS_LOGGER } from "../../progress-logger.js";
import type { ParsedArgs } from "../types.js";

type ProgressLogPolicyArgs = Pick<ParsedArgs, "command" | "jsonOutput" | "prSummary" | "stdoutOnly">;
type ProgressLoggerArgs = ProgressLogPolicyArgs & Pick<ParsedArgs, "verbose">;

export function shouldSuppressProgressLogger(args: ProgressLogPolicyArgs): boolean {
  return args.command === "report-run" && (args.jsonOutput === true || (args.prSummary === true && args.stdoutOnly === true));
}

export function createCliProgressLogger(args: ProgressLoggerArgs, writeLine: (line: string) => void) {
  return shouldSuppressProgressLogger(args) ? NOOP_PROGRESS_LOGGER : createProgressLogger(writeLine, { verbose: args.verbose });
}
