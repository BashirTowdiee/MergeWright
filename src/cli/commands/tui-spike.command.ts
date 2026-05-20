import { createTuiSpikeFixture } from "../../tui/spike-fixture.js";
import { renderTuiSpikeFixture } from "../../tui/spike-renderer.js";
import type { CommandHandler } from "../command-context.js";

export const handleTuiSpikeCommand: CommandHandler = async ({ writeLine }) => {
  const output = renderTuiSpikeFixture(createTuiSpikeFixture());
  for (const line of output.split("\n")) {
    writeLine(line);
  }
};
