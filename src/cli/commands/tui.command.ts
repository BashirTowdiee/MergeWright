import { createTuiSpikeFixture } from "../../tui/spike-fixture.js";
import { renderTuiSpikeFixture } from "../../tui/spike-renderer.js";
import { createTuiFixtureFromRuns } from "../../tui/run-fixture.js";
import { renderTuiApp } from "../../tui/index.js";
import type { TuiSpikeFixture } from "../../tui/spike-fixture.js";
import type { CommandHandler } from "../command-context.js";
import { loadConfigAndRunsRoot } from "../command-helpers.js";

export const handleTuiCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  const fixture = await loadTuiFixture({ configArg: args.configArg, orchestratorRoot });

  if (process.stdout.isTTY) {
    await renderTuiApp(fixture);
    return;
  }

  writeLine(args.configArg ? "MergeWright TUI run inspector" : "MergeWright TUI preview");
  writeLine("Framework: Ink");
  writeLine(args.configArg ? "Mode: read-only run data" : "Mode: read-only preview fixture");
  writeLine("");

  const output = renderTuiSpikeFixture(fixture);
  for (const line of output.split("\n")) {
    writeLine(line);
  }
};

async function loadTuiFixture(input: { configArg?: string; orchestratorRoot: string }): Promise<TuiSpikeFixture> {
  if (!input.configArg) {
    return createTuiSpikeFixture();
  }
  const { runsRoot } = await loadConfigAndRunsRoot(input.orchestratorRoot, input.configArg);
  return createTuiFixtureFromRuns({ runsRoot });
}
