import assert from "node:assert/strict";
import test from "node:test";
import { handleBackfillEvidenceCommand } from "../src/cli/commands/backfill-evidence.command.js";
import { NOOP_PROGRESS_LOGGER } from "../src/progress-logger.js";
import type { ParsedArgs } from "../src/cli.js";

function baseArgs(overrides: Partial<ParsedArgs>): ParsedArgs {
  return {
    command: "backfill-evidence",
    help: false,
    dryRun: false,
    verbose: false,
    force: false,
    configArg: undefined,
    repoOverride: undefined,
    workspaceArg: undefined,
    runId: undefined,
    ...overrides
  } as ParsedArgs;
}

async function runBackfillCommand(args: ParsedArgs): Promise<void> {
  await handleBackfillEvidenceCommand({
    args,
    orchestratorRoot: "/tmp/orchestrator",
    platform: "darwin",
    openRunDirectory: async () => {},
    writeLine: () => {},
    deps: {},
    progressLogger: NOOP_PROGRESS_LOGGER
  });
}

test("handleBackfillEvidenceCommand rejects missing config", async () => {
  await assert.rejects(
    () => runBackfillCommand(baseArgs({ runId: "run-123" })),
    /Missing required --config <config-path>/
  );
});

test("handleBackfillEvidenceCommand rejects missing run id", async () => {
  await assert.rejects(
    () => runBackfillCommand(baseArgs({ configArg: "configs/project.json" })),
    /Usage: agent-stage backfill-evidence <run-id>/
  );
});
