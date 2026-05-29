import type { ParsedArgs } from "../types.js";

export interface CommandPositionals {
  rest: string[];
}

export function parseCommandPositionals(argv: string[], parsed: ParsedArgs): CommandPositionals {
  const [command, firstArg, ...tail] = argv;

  if (command === "run") {
    parsed.stageName = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "init-project") {
    parsed.projectName = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (
    command === "show-run" ||
    command === "open-run" ||
    command === "continue-run" ||
    command === "report-run" ||
    command === "prove" ||
    command === "backfill-evidence"
  ) {
    parsed.runId = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "run-stage" || command === "accept-stage" || command === "fix-stage") {
    parsed.stageId = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  }

  const rest =
    command === "run"
      ? firstArg && firstArg.startsWith("-")
        ? [firstArg, ...tail]
        : tail
      : command === "show-run" ||
          command === "open-run" ||
          command === "continue-run" ||
          command === "report-run" ||
          command === "prove" ||
          command === "backfill-evidence"
        ? firstArg && firstArg.startsWith("-")
          ? [firstArg, ...tail]
          : tail
        : command === "run-stage" || command === "accept-stage" || command === "fix-stage"
          ? firstArg && firstArg.startsWith("-")
            ? [firstArg, ...tail]
            : tail
          : command === "init-project"
            ? firstArg && firstArg.startsWith("-")
              ? [firstArg, ...tail]
              : tail
            : [firstArg, ...tail].filter((token): token is string => typeof token === "string");

  return { rest };
}
