import React from "react";
import { render } from "ink";
import { TuiApp } from "./App.js";
import { createTuiSpikeFixture } from "./spike-fixture.js";

export async function renderTuiApp(): Promise<void> {
  const instance = render(<TuiApp fixture={createTuiSpikeFixture()} />);
  await instance.waitUntilExit();
}
