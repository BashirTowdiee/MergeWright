import { createEvidenceSnippet, type EvidenceSnippet } from "./evidence-preview.js";
import { inspectRunForTui, listRunsForTui, readArtefactForTui } from "./read-model.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";
import type { ArtefactViewModel, RenderableArtefact, RunDetailViewModel } from "./view-models.js";

export async function createTuiFixtureFromRuns(input: { runsRoot: string }): Promise<TuiSpikeFixture> {
  const runs = await listRunsForTui({ runsRoot: input.runsRoot });
  if (runs.length === 0) {
    const selectedRun = createEmptyRunDetail(input.runsRoot);
    return {
      runs: [],
      selectedRun,
      runDetailsById: { [selectedRun.id]: selectedRun },
      evidenceSnippets: {}
    };
  }

  const details = await Promise.all(runs.map((run) => inspectRunForTui({ runsRoot: input.runsRoot, runId: run.id })));
  const runDetailsById = Object.fromEntries(details.map((detail) => [detail.id, detail]));
  const evidenceSnippets = await loadEvidenceSnippets({ runsRoot: input.runsRoot, details });

  return {
    runs,
    selectedRun: details[0] ?? createEmptyRunDetail(input.runsRoot),
    runDetailsById,
    evidenceSnippets
  };
}

async function loadEvidenceSnippets(input: { runsRoot: string; details: RunDetailViewModel[] }): Promise<Record<string, EvidenceSnippet>> {
  const entries = await Promise.all(
    input.details.flatMap((detail) => detail.artefacts.map((artefact) => loadEvidenceSnippet(input.runsRoot, detail.id, artefact)))
  );
  return Object.fromEntries(entries.filter((entry): entry is [string, EvidenceSnippet] => entry !== null));
}

async function loadEvidenceSnippet(runsRoot: string, runId: string, artefact: ArtefactViewModel): Promise<[string, EvidenceSnippet] | null> {
  try {
    const renderable = await readArtefactForTui({ runsRoot, runId, artefactId: artefact.path });
    const content = getRenderableContent(renderable);
    return [artefact.id, createEvidenceSnippet({ artefactId: artefact.id, content })];
  } catch {
    return null;
  }
}

function getRenderableContent(artefact: RenderableArtefact): string {
  if (artefact.kind === "json") {
    return artefact.content;
  }
  if (artefact.kind === "log") {
    return artefact.lines.join("\n");
  }
  return artefact.content;
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
