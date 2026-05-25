import type { RunDetail, RunPhaseStatus, RunStatus, RunSummary } from "./run-read-model.js";

export interface DemoRunReadModels {
  runs: RunSummary[];
  selectedRun: RunDetail;
  runDetailsById: Record<string, RunDetail>;
}

export function createDemoRunReadModels(): DemoRunReadModels {
  const selectedRunId = "20260520-000002-review-failed";
  const selectedRun: RunDetail = {
    id: selectedRunId,
    title: "docs-site build",
    goal: "Add product delivery docs, Astro docs site, and CI workflow.",
    status: "failed",
    workspaceRoot: "/absolute/path/to/orchestrator",
    runDir: `/tmp/MergeWright/runs/${selectedRunId}`,
    branch: "docs/product-delivery-pack",
    mode: "read-only",
    provider: "codex",
    model: "gpt-5.5-codex",
    blockedReason: "Reviewer found a blocking docs route issue.",
    warnings: [],
    phases: [
      { id: "planner", label: "Planner", status: "passed", summary: "Created staged documentation plan.", artefactIds: ["planner-output"] },
      { id: "builder", label: "Builder", status: "passed", summary: "Added docs and Astro site.", artefactIds: ["builder-output"] },
      {
        id: "reviewer",
        label: "Reviewer",
        status: "failed",
        summary: "Docs route assumes optional order metadata exists.",
        artefactIds: ["reviewer-output"],
        blockedReason: "Fix reviewer finding before checks."
      },
      { id: "fixPlanning", label: "Fix Planner", status: "pending", summary: "Ready to plan fix.", artefactIds: [] },
      { id: "fixExecution", label: "Fix Executor", status: "pending", summary: "Waiting for fix plan.", artefactIds: [] },
      { id: "checks", label: "Checks", status: "blocked", summary: "Blocked until review passes.", artefactIds: [], blockedReason: "Reviewer failed." }
    ],
    artefacts: [
      { id: "planner-output", title: "planner-output-last-message.md", kind: "markdown", path: "06-planner-output-last-message.md", phaseId: "planner" },
      { id: "builder-output", title: "builder-output-last-message.md", kind: "markdown", path: "builder-output-last-message.md", phaseId: "builder" },
      { id: "reviewer-output", title: "reviewer-output-last-message.md", kind: "markdown", path: "reviewer-output-last-message.md", phaseId: "reviewer" },
      { id: "run-metadata", title: "run.json", kind: "json", path: "run.json" }
    ],
    reviewerFindings: [
      { severity: "high", message: "docs-site route assumes optional order metadata exists.", sourceArtefactId: "reviewer-output" },
      { severity: "low", message: "PR docs wording can be tightened.", sourceArtefactId: "reviewer-output" }
    ],
    safeActions: [
      { id: "request-fix", label: "Generate fix prompt", enabled: true, risk: "medium", requiresConfirmation: false },
      { id: "open-artefact", label: "Open reviewer output", enabled: true, risk: "low", requiresConfirmation: false },
      { id: "generate-report", label: "Generate change report", enabled: true, risk: "low", requiresConfirmation: false },
      { id: "continue", label: "Continue run", enabled: false, blockedReason: "Fix is required before continuation.", risk: "medium", requiresConfirmation: false }
    ]
  };

  const passedRun = createSimpleRunDetail({
    id: "20260520-000001-product-docs",
    title: "product docs pass",
    status: "passed",
    summary: "Product docs updated and reviewed successfully."
  });
  const blockedRun = createSimpleRunDetail({
    id: "20260519-235959-provider-config",
    title: "provider config",
    status: "blocked",
    summary: "OpenCode provider decision pending.",
    blockedReason: "Provider metadata is incomplete."
  });

  return {
    selectedRun,
    runDetailsById: {
      [selectedRun.id]: selectedRun,
      [passedRun.id]: passedRun,
      [blockedRun.id]: blockedRun
    },
    runs: [
      {
        id: selectedRunId,
        title: "docs-site build",
        status: "failed",
        subtitle: "PR #1 · reviewer failed",
        startedAt: "2026-05-20T00:00:00.000Z",
        completedAt: "2026-05-20T00:01:00.000Z",
        branch: "docs/product-delivery-pack",
        mode: "read-only",
        warnings: []
      },
      {
        id: passedRun.id,
        title: "product docs pass",
        status: "passed",
        subtitle: "Product docs updated",
        startedAt: "2026-05-20T00:00:00.000Z",
        completedAt: "2026-05-20T00:01:00.000Z",
        branch: "main",
        mode: "read-only",
        warnings: []
      },
      {
        id: blockedRun.id,
        title: "provider config",
        status: "blocked",
        subtitle: "OpenCode provider decision pending",
        startedAt: "2026-05-19T23:59:59.000Z",
        branch: "provider-switching",
        mode: "unknown",
        warnings: ["Provider metadata is incomplete."]
      }
    ]
  };
}

function createSimpleRunDetail(input: {
  id: string;
  title: string;
  status: RunStatus;
  summary: string;
  blockedReason?: string;
}): RunDetail {
  const reviewerStatus = mapRunStatusToPhaseStatus(input.status);
  return {
    id: input.id,
    title: input.title,
    goal: input.summary,
    status: input.status,
    runDir: `/tmp/MergeWright/runs/${input.id}`,
    mode: "read-only",
    blockedReason: input.blockedReason,
    warnings: [],
    phases: [
      { id: "planner", label: "Planner", status: input.status === "passed" ? "passed" : "unknown", artefactIds: [] },
      { id: "builder", label: "Builder", status: input.status === "passed" ? "passed" : "unknown", artefactIds: [] },
      { id: "reviewer", label: "Reviewer", status: reviewerStatus, artefactIds: [], blockedReason: input.blockedReason }
    ],
    artefacts: [],
    reviewerFindings: input.blockedReason ? [{ severity: "unknown", message: input.blockedReason }] : [],
    safeActions: [
      { id: "open-run-folder", label: "Open run folder", enabled: true, risk: "low", requiresConfirmation: false }
    ]
  };
}

function mapRunStatusToPhaseStatus(status: RunStatus): RunPhaseStatus {
  if (status === "passed" || status === "failed" || status === "blocked" || status === "pending" || status === "running" || status === "unknown") {
    return status;
  }
  return "unknown";
}
