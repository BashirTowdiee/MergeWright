import React from "react";
import { render } from "ink";
import { SelectableTuiApp } from "./SelectableApp.js";
import { createTuiSpikeFixture, type TuiSpikeFixture } from "./spike-fixture.js";

export async function renderTuiApp(fixture: TuiSpikeFixture = createTuiSpikeFixture()): Promise<void> {
  const instance = render(<SelectableTuiApp fixture={fixture} />);
  await instance.waitUntilExit();
}
