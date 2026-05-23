import { buildEvidencePreview, type EvidenceSnippet } from "./evidence-preview.js";
import { buildFindingDetailLines } from "./finding-detail.js";
import { formatFileScopeLabel, type FileScope } from "./file-scope.js";
import { buildFocusBreadcrumb } from "./focus-breadcrumb.js";
import type { FocusedPane } from "./focus.js";
import { buildLayoutSummary } from "./layout-summary.js";
import { buildPhaseDetailLines } from "./phase-detail.js";
import { buildRunContextLines } from "./run-context.js";
import { buildRunWarningLines } from "./run-warnings.js";
import type { TuiSelectionContext } from "./selection-context-read-model.js";
import type { RunListItemViewModel } from "./view-models.js";

export type TuiDashboardReadModelInput = {
  readonly runs: readonly RunListItemViewModel[];
  readonly selectionContext: TuiSelectionContext;
  readonly evidenceSnippets?: Record<string, EvidenceSnippet>;
  readonly focusedPane: FocusedPane;
  readonly fileScope: FileScope;
};

export type TuiDashboardReadModel = {
  readonly evidenceLines: string[];
  readonly focusBreadcrumb: string;
  readonly findingDetailLines: string[];
  readonly runContextLines: string[];
  readonly runWarningLines: string[];
  readonly phaseDetailLines: string[];
  readonly layoutSummary: string;
  readonly fileScopeLabel: string;
};

export function buildTuiDashboardReadModel(input: TuiDashboardReadModelInput): TuiDashboardReadModel {
  const { selectedRun, selectedPhase, selectedArtefact, selectedFinding } = input.selectionContext;

  return {
    evidenceLines: buildEvidencePreview({
      artefact: selectedArtefact,
      findings: selectedRun.reviewerFindings,
      snippets: input.evidenceSnippets
    }),
    focusBreadcrumb: buildFocusBreadcrumb({
      focusedPane: input.focusedPane,
      selectedRun,
      selectedPhase,
      fileScope: input.fileScope
    }),
    findingDetailLines: buildFindingDetailLines(selectedFinding),
    runContextLines: buildRunContextLines(selectedRun),
    runWarningLines: buildRunWarningLines(selectedRun.warnings),
    phaseDetailLines: buildPhaseDetailLines(selectedPhase),
    layoutSummary: buildLayoutSummary({ runs: [...input.runs], selectedRun }),
    fileScopeLabel: formatFileScopeLabel({ scope: input.fileScope, selectedPhase })
  };
}
