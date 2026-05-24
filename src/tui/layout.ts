export interface TuiPaneLayout {
  topRowDirection: "row" | "column";
  bottomRowDirection: "row" | "column";
  runListWidth: number | "100%";
  currentRunWidth: number | "100%";
  safeActionWidth: number | "100%";
  artefactWidth: number | "100%";
  evidenceWidth: number | "100%";
  rowPaneMarginRight: number;
}

const ROW_LAYOUT: TuiPaneLayout = {
  topRowDirection: "row",
  bottomRowDirection: "row",
  runListWidth: 30,
  currentRunWidth: 52,
  safeActionWidth: 42,
  artefactWidth: 46,
  evidenceWidth: 80,
  rowPaneMarginRight: 1
};

const STACKED_LAYOUT: TuiPaneLayout = {
  topRowDirection: "column",
  bottomRowDirection: "column",
  runListWidth: "100%",
  currentRunWidth: "100%",
  safeActionWidth: "100%",
  artefactWidth: "100%",
  evidenceWidth: "100%",
  rowPaneMarginRight: 0
};

export function resolveTuiPaneLayout(columns?: number): TuiPaneLayout {
  const width = normalizeColumns(columns);
  const requiresStackedLayout = width < 132;
  return requiresStackedLayout ? STACKED_LAYOUT : ROW_LAYOUT;
}

function normalizeColumns(columns?: number): number {
  if (typeof columns !== "number" || !Number.isFinite(columns)) {
    return 120;
  }
  return Math.max(40, Math.floor(columns));
}

