import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCliCommand } from "../src/cli/dispatch.js";
import type { CommandContext } from "../src/cli/command-context.js";
import type { ParsedArgs } from "../src/cli/types.js";
import { NOOP_PROGRESS_LOGGER } from "../src/progress-logger.js";

function createContext(args: ParsedArgs): CommandContext {
  return {
    args,
    orchestratorRoot: "/tmp/orchestrator",
    platform: "linux",
    openRunDirectory: async () => {},
    writeLine: () => {},
    deps: {},
    progressLogger: NOOP_PROGRESS_LOGGER
  };
}

const baseArgs: ParsedArgs = {
  help: false,
  force: false,
  dryRun: false,
  executePlanner: false,
  executeBuilder: false,
  executeReviewer: false,
  planFix: false,
  executeFix: false,
  runChecks: false,
  allowWrites: false,
  verbose: false,
  streamCodex: false,
  autoChain: false,
  generateReport: false,
  planHtml: false,
  openPlan: false,
  stopAfterEachStage: false,
  reassessDownstream: false,
  autoCommit: false
};

test("dispatcher rejects missing command with help text", async () => {
  await assert.rejects(
    dispatchCliCommand({
      command: undefined,
      context: createContext(baseArgs),
      helpText: "HELP"
    }),
    /Missing command/
  );
});

test("dispatcher rejects unknown command with help text", async () => {
  await assert.rejects(
    dispatchCliCommand({
      command: "unknown-command",
      context: createContext({ ...baseArgs, command: "unknown-command" }),
      helpText: "HELP"
    }),
    /Unknown command: unknown-command/
  );
});
