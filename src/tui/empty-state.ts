export type EmptyStateKind = "runs" | "phases" | "actions" | "artefacts" | "findings";

const EMPTY_STATE_MESSAGES: Record<EmptyStateKind, string> = {
  runs: "No runs found. Start a run to populate this view.",
  phases: "No phase metadata recorded for this run.",
  actions: "No safe actions are available for this run.",
  artefacts: "No artefacts recorded for this run.",
  findings: "No reviewer findings recorded."
};

export function getEmptyStateMessage(kind: EmptyStateKind): string {
  return EMPTY_STATE_MESSAGES[kind];
}
