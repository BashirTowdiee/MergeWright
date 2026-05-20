import React from "react";
import { render } from "ink";
import { TuiApp } from "./App.js";
import { createTuiSpikeFixture, type TuiSpikeFixture } from "./spike-fixture.js";

export async function renderTuiApp(fixture: TuiSpikeFixture = createTuiSpikeFixture()): Promise<void> {
  const instance = render(<TuiApp fixture={fixture} />);
  await instance.waitUntilExit();
}
