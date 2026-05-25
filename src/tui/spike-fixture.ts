import { createDemoRunReadModels } from "../application/read-models/demo-run-read-models.js";
import type { EvidenceSnippet } from "./evidence-preview.js";
import type { RunDetailViewModel, RunListItemViewModel } from "./view-models.js";

export interface TuiSpikeFixture {
  runs: RunListItemViewModel[];
  selectedRun: RunDetailViewModel;
  runDetailsById: Record<string, RunDetailViewModel>;
  evidenceSnippets?: Record<string, EvidenceSnippet>;
}

export function createTuiSpikeFixture(): TuiSpikeFixture {
  return createDemoRunReadModels();
}
