import { inspectRunForTui, listRunsForTui } from "./read-model.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";
import type { RunDetailViewModel } from "./view-models.js";

export async function createTuiFixtureFromRuns(input: { runsRoot: string }): Promise<TuiSpikeFixture> {
  const runs = await listRunsForTui({ runsRoot: input.runsRoot });
  if (runs.length === 0) {
    return {
      runs: [],
      selectedRun: createEmptyRunDetail(input.runsRoot)
    };
  }

  return {
    runs,
    selectedRun: await inspectRunForTui({ runsRoot: input.runsRoot, runId: runs[0].id })
  };
}

function createEmptyRunDetail(runsRoot: string): RunDetailViewModel {
  return {
    id: "empty",
    title: "No runs found",
    goal: "Run a stage to populate this view.",
    status: "unknown",
    runDir: runsRoot,
    mode: "unknown",
    phases: [],
    artefacts: [],
    safeActions: [
      {
        id: "open-run-folder",
        label: "Open runs folder",
        enabled: true,
        risk: "low",
        requiresConfirmation: false
      }
    ],
    reviewerFindings: [],
    warnings: []
  };
}
