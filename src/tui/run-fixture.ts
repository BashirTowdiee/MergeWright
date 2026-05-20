import { inspectRunForTui, listRunsForTui } from "./read-model.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";
import type { RunDetailViewModel } from "./view-models.js";

export async function createTuiFixtureFromRuns(input: { runsRoot: string }): Promise<TuiSpikeFixture> {
  const runs = await listRunsForTui({ runsRoot: input.runsRoot });
  if (runs.length === 0) {
    const selectedRun = createEmptyRunDetail(input.runsRoot);
    return {
      runs: [],
      selectedRun,
      runDetailsById: { [selectedRun.id]: selectedRun }
    };
  }

  const details = await Promise.all(runs.map((run) => inspectRunForTui({ runsRoot: input.runsRoot, runId: run.id })));
  const runDetailsById = Object.fromEntries(details.map((detail) => [detail.id, detail]));

  return {
    runs,
    selectedRun: details[0] ?? createEmptyRunDetail(input.runsRoot),
    runDetailsById
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
