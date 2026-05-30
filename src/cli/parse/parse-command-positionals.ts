import type { ParsedArgs } from "../types.js";

export interface CommandPositionals {
  rest: string[];
}

export function parseCommandPositionals(argv: string[], parsed: ParsedArgs): CommandPositionals {
  const [command] = argv;
  let restStart = 1;

  if (command === "run") {
    const stageName = consumePositional(argv[1]);
    parsed.stageName = stageName;
    if (stageName) {
      restStart = 2;
    }
  } else if (command === "init-project") {
    const projectName = consumePositional(argv[1]);
    parsed.projectName = projectName;
    if (projectName) {
      restStart = 2;
    }
  } else if (
    command === "show-run" ||
    command === "open-run" ||
    command === "continue-run" ||
    command === "report-run" ||
    command === "prove" ||
    command === "review-modes" ||
    command === "backfill-evidence"
  ) {
    const runId = consumePositional(argv[1]);
    parsed.runId = runId;
    if (runId) {
      restStart = 2;
    }
  } else if (command === "compare-runs") {
    const runId = consumePositional(argv[1]);
    parsed.runId = runId;
    if (runId) {
      restStart = 2;
    }
    const compareRunId = consumePositional(argv[restStart]);
    parsed.compareRunId = compareRunId;
    if (compareRunId) {
      restStart += 1;
    }
  } else if (command === "run-stage" || command === "accept-stage" || command === "fix-stage") {
    const stageId = consumePositional(argv[1]);
    parsed.stageId = stageId;
    if (stageId) {
      restStart = 2;
    }
  }

  return {
    rest: argv.slice(restStart).filter((token): token is string => typeof token === "string")
  };
}

function consumePositional(token: string | undefined): string | undefined {
  if (!token || token.startsWith("-")) {
    return undefined;
  }
  return token;
}
