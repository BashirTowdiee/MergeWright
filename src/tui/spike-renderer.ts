import type { TuiSpikeFixture } from "./spike-fixture.js";
import type { TuiPhaseStatus, TuiRunStatus } from "./view-models.js";

const STATUS_SYMBOL: Record<TuiRunStatus | TuiPhaseStatus, string> = {
  pending: "○",
  running: "…",
  passed: "✓",
  failed: "!",
  blocked: "■",
  cancelled: "×",
  skipped: "-",
  unknown: "?"
};

export function renderTuiSpikeFixture(fixture: TuiSpikeFixture): string {
  const runLines = fixture.runs.map((run) => `${STATUS_SYMBOL[run.status]} ${run.title}\n  ${run.subtitle}`);
  const phaseLines = fixture.selectedRun.phases.map((phase) => {
    const suffix = phase.blockedReason ? ` · ${phase.blockedReason}` : phase.summary ? ` · ${phase.summary}` : "";
    return `${STATUS_SYMBOL[phase.status]} ${phase.label}${suffix}`;
  });
  const actionLines = fixture.selectedRun.safeActions.map((action) => {
    const symbol = action.enabled ? "›" : "×";
    const suffix = action.blockedReason ? ` · ${action.blockedReason}` : "";
    return `${symbol} ${action.label}${suffix}`;
  });
  const artefactLines = fixture.selectedRun.artefacts.map((artefact) => `${artefact.kind.padEnd(8)} ${artefact.title}`);
  const findingLines = fixture.selectedRun.reviewerFindings.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`);

  return [
    "Shepherds-Staff TUI spike",
    `Repo: ${fixture.selectedRun.workspaceRoot ?? "unknown"}`,
    `Branch: ${fixture.selectedRun.branch ?? "unknown"}`,
    "",
    "Runs",
    "----",
    ...runLines,
    "",
    "Current run",
    "-----------",
    fixture.selectedRun.title,
    fixture.selectedRun.goal ?? "No goal recorded.",
    `Status: ${fixture.selectedRun.status}`,
    "",
    "Phase flow",
    "----------",
    ...phaseLines,
    "",
    "Safe action",
    "-----------",
    fixture.selectedRun.blockedReason ?? "No blocker recorded.",
    ...actionLines,
    "",
    "Artefacts",
    "---------",
    ...artefactLines,
    "",
    "Review findings",
    "---------------",
    ...findingLines
  ].join("\n");
}
