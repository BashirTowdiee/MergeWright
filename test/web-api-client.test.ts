import test from "node:test";
import assert from "node:assert/strict";
import type { RunContract } from "../src/application/audited-flow/contract.js";
import type { AuditedFlowAuditEventView } from "../src/application/read-models/audited-flow-read-model.js";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { RunDetail, RunSummary } from "../src/application/read-models/run-read-model.js";
import type { AuditedFlowResult } from "../src/application/use-cases/execute-audited-flow-use-case.js";
import { MergeWrightApiClient, WebApiError, type WebApiFetch } from "../src/web/api-client.js";
import { toRunDetailViewModel, toRunListItemViewModel } from "../src/web/run-view-model.js";

const runSummary: RunSummary = {
  id: "run-1",
  title: "Run one",
  subtitle: "In progress",
  status: "running",
  branch: "feature/demo",
  mode: "read-only",
  warnings: ["Check reviewer notes"]
};

const runDetail: RunDetail = {
  id: "run-1",
  title: "Run one",
  status: "blocked",
  runDir: "/tmp/run-1",
  branch: undefined,
  mode: "auto-chain",
  phases: [
    {
      id: "planner",
      label: "Planner",
      status: "passed",
      summary: "Plan complete",
      durationMs: 1450,
      artefactIds: ["plan"]
    },
    {
      id: "builder",
      label: "Builder",
      status: "blocked",
      artefactIds: [],
      blockedReason: "Needs confirmation"
    }
  ],
  artefacts: [
    {
      id: "plan",
      title: "Plan",
      kind: "markdown",
      path: "plan.md",
      phaseId: "planner"
    }
  ],
  safeActions: [
    {
      id: "continue",
      label: "Continue",
      enabled: true,
      risk: "low",
      requiresConfirmation: false
    },
    {
      id: "request-fix",
      label: "Request fix",
      enabled: false,
      blockedReason: "Needs confirmation",
      risk: "high",
      requiresConfirmation: true
    }
  ],
  blockedReason: "Needs confirmation",
  reviewerFindings: [
    {
      severity: "medium",
      message: "Missing tests"
    }
  ],
  warnings: []
};

const auditedFlowEvents: AuditedFlowAuditEventView[] = [
  {
    type: "run.created",
    runId: "run-1",
    occurredAt: "2026-06-09T00:00:00.000Z",
    payload: {
      flow: "feature-standard"
    }
  }
];

const auditedFlowResult: AuditedFlowResult = {
  runId: "audited-run-1",
  status: "passed",
  stageResults: [
    {
      stageId: "plan",
      kind: "plan",
      executor: "deterministic-dry-run",
      status: "passed",
      summary: "Dry-run plan completed."
    }
  ],
  auditPath: "/tmp/runs/audited-run-1/audit.ndjson",
  artefactsDir: "/tmp/runs/audited-run-1",
  dryRun: true
};

function createFetch(payloads: Record<string, unknown>, calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }>): WebApiFetch {
  return async (url, init) => {
    calls.push({ url, init });
    const payload = payloads[url];
    return {
      ok: payload !== undefined,
      status: payload === undefined ? 404 : 200,
      async json() {
        return payload ?? { code: "NOT_FOUND", message: "Missing" };
      }
    };
  };
}

test("MergeWrightApiClient lists runs with optional status filter", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000/",
    fetch: createFetch({ "http://localhost:3000/runs?status=running": { runs: [runSummary] } }, calls)
  });

  const runs = await client.listRuns("running");

  assert.deepEqual(runs, [runSummary]);
  assert.deepEqual(calls, [{ url: "http://localhost:3000/runs?status=running", init: undefined }]);
});

test("MergeWrightApiClient fetches run detail and artifact metadata", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch(
      {
        "http://localhost:3000/runs/run-1": { run: runDetail },
        "http://localhost:3000/runs/run-1/readiness": {
          readiness: {
            runId: "run-1",
            ready: false,
            status: "NEEDS_FIX",
            score: 62,
            risk: "high",
            checksState: "failed",
            reviewerVerdict: "FAIL",
            missingEvidenceWarnings: ["Acceptance evidence missing."],
            blockedReason: "Needs confirmation",
            nextAction: "request-fix"
          }
        },
        "http://localhost:3000/runs/run-1/review": {
          review: {
            runId: "run-1",
            verdict: "FAIL",
            blockingFindings: [
              {
                severity: "high",
                message: "Missing acceptance coverage"
              }
            ],
            nonBlockingFindings: [
              {
                severity: "low",
                message: "Consider smaller helper modules"
              }
            ],
            recommendedFixPrompt: "Fix acceptance coverage and rerun checks.",
            testsObservedCount: 2,
            acceptanceCriteriaCount: 3
          }
        },
        "http://localhost:3000/runs/run-1/evidence": {
          evidence: {
            runId: "run-1",
            available: true,
            status: "needs_fix",
            blockerCount: 2,
            warningCount: 1,
            items: [
              {
                id: "manifest",
                label: "Evidence manifest",
                status: "pass",
                blocking: true,
                note: "status=needs_fix",
                sourcePath: "evidence.json"
              }
            ]
          }
        },
        "http://localhost:3000/runs/run-1/audit-events": {
          events: auditedFlowEvents
        },
        "http://localhost:3000/runs/run-1/phase-artifacts": {
          phaseArtifacts: {
            runId: "run-1",
            phases: [
              {
                id: "planner",
                label: "Planner",
                status: "passed",
                artifacts: [runDetail.artefacts[0]]
              }
            ],
            unassignedArtifacts: []
          }
        },
        "http://localhost:3000/runs/compare?runA=run-1&runB=run-2": {
          comparison: {
            version: 1,
            runA: {
              runId: "run-1",
              status: "NEEDS_FIX",
              score: 62,
              risk: "high",
              reviewerVerdict: "FAIL",
              checksState: "failed",
              changedFileCount: 5,
              acceptanceCriteria: { expected: 3, passed: 1, failed: 2, unknown: 0 },
              missingEvidenceWarnings: ["Acceptance evidence missing."]
            },
            runB: {
              runId: "run-2",
              status: "READY",
              score: 91,
              risk: "low",
              reviewerVerdict: "PASS",
              checksState: "passed",
              changedFileCount: 4,
              acceptanceCriteria: { expected: 3, passed: 3, failed: 0, unknown: 0 },
              missingEvidenceWarnings: []
            },
            deltas: {
              score: 29,
              risk: "lower",
              readinessChanged: true,
              checksChanged: true,
              reviewerChanged: true,
              changedFileCount: -1
            },
            changedFiles: {
              onlyInA: ["src/a.ts"],
              onlyInB: ["src/b.ts"],
              inBothCount: 2
            },
            checks: {
              failedOnlyInA: ["npm test"],
              failedOnlyInB: []
            },
            acceptance: {
              regressions: [],
              improvements: ["criteria-a: fail -> pass"]
            }
          }
        },
        "http://localhost:3000/runs/run-1/events?limit=20": {
          events: [
            {
              timestamp: "2026-05-31T00:00:00.000Z",
              requestId: "req-1",
              command: "continue-run",
              status: "started",
              runId: "run-1"
            }
          ]
        },
        "http://localhost:3000/commands/req-1/events?limit=20": {
          events: [
            {
              timestamp: "2026-05-31T00:00:01.000Z",
              requestId: "req-1",
              command: "continue-run",
              status: "completed",
              ok: true,
              exitCode: 0,
              runId: "run-1"
            }
          ]
        },
        "http://localhost:3000/runs/run-1/artifacts?phaseId=planner": { artifacts: [runDetail.artefacts[0]] },
        "http://localhost:3000/runs/run-1/artifacts/plan": { artifact: runDetail.artefacts[0] },
        "http://localhost:3000/runs/run-1/artifacts/plan/content?maxBytes=2048": {
          artifact: runDetail.artefacts[0],
          content: "# plan",
          truncated: false,
          maxBytes: 2048
        },
        "http://localhost:3000/stage-plans": {
          stagePlans: [
            {
              id: "c3RhZ2UtcGxhbnMvZGVtby9zdGFnZS1wbGFuLmpzb24",
              planId: "provider-switching",
              title: "Provider switching",
              goal: "Migrate providers safely",
              source: "imported",
              status: "running",
              updatedAt: "2026-05-31T02:00:00.000Z",
              stageCount: 2,
              path: "stage-plans/demo/stage-plan.json"
            }
          ]
        },
        "http://localhost:3000/stage-plans/c3RhZ2UtcGxhbnMvZGVtby9zdGFnZS1wbGFuLmpzb24": {
          stagePlan: {
            id: "c3RhZ2UtcGxhbnMvZGVtby9zdGFnZS1wbGFuLmpzb24",
            planId: "provider-switching",
            title: "Provider switching",
            goal: "Migrate providers safely",
            source: "imported",
            status: "running",
            createdAt: "2026-05-31T01:00:00.000Z",
            updatedAt: "2026-05-31T02:00:00.000Z",
            path: "stage-plans/demo/stage-plan.json",
            stageCount: 2,
            statusCounts: {
              pending: 1,
              running: 1,
              reviewRequired: 0,
              accepted: 0,
              fixRequired: 0,
              failed: 0,
              committed: 0
            },
            stages: [
              {
                id: "stage-01-provider-contract",
                index: 1,
                title: "Provider contract",
                status: "running",
                dependsOn: [],
                revision: 1,
                acceptanceCriteriaCount: 2,
                checksCount: 1
              }
            ]
          }
        },
        "http://localhost:3000/projects": {
          projects: [
            {
              id: "default",
              name: "MergeWright",
              configPath: "/tmp/config.json",
              workspaceRoot: "/tmp/workspace",
              runsRoot: "/tmp/runs",
              defaultProvider: "codex-local"
            }
          ]
        },
        "http://localhost:3000/projects/default": {
          project: {
            id: "default",
            name: "MergeWright",
            configPath: "/tmp/config.json",
            workspaceRoot: "/tmp/workspace",
            runsRoot: "/tmp/runs",
            defaultProvider: "codex-local",
            orchestratorRoot: "/tmp/orchestrator",
            stagesRoot: "/tmp/orchestrator/stages",
            promptsRoot: "/tmp/orchestrator/prompts",
            providers: ["codex-local", "opencode-local"]
          }
        },
        "http://localhost:3000/projects/default/health": {
          health: {
            projectId: "default",
            healthy: true,
            checks: {
              configPathExists: true,
              workspaceRootExists: true,
              runsRootExists: true,
              stagesRootExists: true,
              promptsRootExists: true
            },
            warnings: []
          }
        },
        "http://localhost:3000/providers": {
          inventory: {
            defaultProvider: "codex-local",
            providers: [
              {
                id: "codex-local",
                type: "codex-cli",
                command: "codex",
                usedByRoles: ["planner", "builder", "reviewer"],
                supportsReadOnly: true,
                supportsWrites: true,
                supportsProbe: false
              }
            ]
          }
        },
        "http://localhost:3000/policy": {
          policy: {
            requireGitRepo: true,
            requireCleanStart: true,
            manualCommitOnly: true,
            forbidAutoCommit: true,
            forbidAutoPush: true,
            writeSafetyEnabled: true,
            requireCleanWorkingTree: true,
            requireExplicitAllowWrites: true,
            requireReviewAfterWrites: true,
            allowedBranches: ["main"],
            blockedPaths: ["package-lock.json"],
            checkCount: 2
          }
        },
        "http://localhost:3000/safety/write-status": {
          status: {
            checkedAt: "2026-05-31T00:00:00.000Z",
            ok: true,
            summary: "Write safety checks passed.",
            failures: [],
            warnings: [],
            enabled: true,
            branch: "feature/demo",
            isGitWorkTree: true,
            workingTreeState: "clean",
            changedFilesCount: 0,
            blockedMatchCount: 0
          }
        },
        "http://localhost:3000/settings": {
          settings: {
            version: 1,
            project: {
              activeProjectId: "default",
              defaultConfigPath: "/tmp/config.json",
              runsRoot: "/tmp/runs",
              defaultProvider: "codex-local",
              defaultModel: "gpt-5.3-codex",
              defaultMode: "preview-first"
            },
            retention: {
              evidenceDays: 30,
              artifactDays: 30
            },
            ui: {
              theme: "system",
              keyboardShortcuts: true
            },
            updatedAt: "2026-05-31T00:00:00.000Z"
          }
        },
        "http://localhost:3000/reviews": {
          reviews: [
            {
              id: "run-1",
              runId: "run-1",
              title: "Run one",
              status: "pending",
              readinessStatus: "NEEDS_FIX",
              reviewerVerdict: "FAIL",
              checksState: "failed",
              blockerCount: 1,
              blockers: ["Missing acceptance coverage"],
              commentCount: 1,
              updatedAt: "2026-05-31T02:30:00.000Z",
              comments: [
                {
                  id: "comment-1",
                  author: "operator",
                  message: "Please address the blocker.",
                  createdAt: "2026-05-31T02:20:00.000Z"
                }
              ]
            }
          ]
        }
      },
      calls
    )
  });

  assert.deepEqual(await client.getRun("run-1"), runDetail);
  assert.equal((await client.getRunReadiness("run-1")).status, "NEEDS_FIX");
  assert.equal((await client.getRunReview("run-1")).verdict, "FAIL");
  assert.equal((await client.getRunEvidence("run-1")).available, true);
  assert.deepEqual(await client.getRunAuditEvents("run-1"), auditedFlowEvents);
  assert.equal((await client.getRunPhaseArtifacts("run-1")).phases.length, 1);
  assert.equal((await client.getRunComparison("run-1", "run-2")).deltas.risk, "lower");
  assert.equal((await client.getRunEvents("run-1", 20)).length, 1);
  assert.equal((await client.getCommandEvents("req-1", 20))[0]?.status, "completed");
  assert.deepEqual(await client.listRunArtifacts("run-1", "planner"), [runDetail.artefacts[0]]);
  assert.deepEqual(await client.getRunArtifact("run-1", "plan"), runDetail.artefacts[0]);
  assert.deepEqual(await client.getRunArtifactContent("run-1", "plan", 2048), {
    artifact: runDetail.artefacts[0],
    content: "# plan",
    truncated: false,
    maxBytes: 2048
  });
  assert.equal((await client.listProjects()).length, 1);
  assert.equal((await client.getProject("default")).id, "default");
  assert.equal((await client.getProjectHealth("default")).healthy, true);
  assert.equal((await client.getProviderInventory()).defaultProvider, "codex-local");
  assert.equal((await client.getPolicy()).writeSafetyEnabled, true);
  assert.equal((await client.getWriteSafetyStatus()).ok, true);
  assert.equal((await client.getSettings()).project.defaultMode, "preview-first");
  assert.equal((await client.listReviews())[0]?.status, "pending");
  assert.equal((await client.listStagePlans()).length, 1);
  assert.equal((await client.getStagePlan("c3RhZ2UtcGxhbnMvZGVtby9zdGFnZS1wbGFuLmpzb24")).planId, "provider-switching");
});

test("MergeWrightApiClient submits commands through the API", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const command: AppCommand = {
    commandId: "cmd-1",
    source: "automation",
    requestedAt: "2026-05-25T00:00:00.000Z",
    type: "select-task",
    taskId: "task-1"
  };
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch(
      {
        "http://localhost:3000/commands": {
          result: { ok: true, commandId: "cmd-1", type: "select-task", message: "Accepted" }
        },
        "http://localhost:3000/commands/preview": {
          description: {
            commandId: "cmd-1",
            type: "select-task",
            title: "Select task",
            summary: "Selects the active task for review.",
            risk: "low",
            requiresConfirmation: false,
            preconditions: [],
            effects: []
          }
        },
        "http://localhost:3000/reviews/run-1/comments": {
          review: {
            id: "run-1",
            runId: "run-1",
            title: "Run one",
            status: "pending",
            readinessStatus: "NEEDS_FIX",
            reviewerVerdict: "FAIL",
            checksState: "failed",
            blockerCount: 1,
            blockers: ["Missing acceptance coverage"],
            commentCount: 2,
            updatedAt: "2026-05-31T03:00:00.000Z",
            comments: [
              { id: "comment-1", author: "operator", message: "Please address blocker.", createdAt: "2026-05-31T02:20:00.000Z" },
              { id: "comment-2", author: "lead", message: "rerun reviewer", createdAt: "2026-05-31T03:00:00.000Z" }
            ]
          }
        },
        "http://localhost:3000/reviews/run-1/approval": {
          review: {
            id: "run-1",
            runId: "run-1",
            title: "Run one",
            status: "approved",
            readinessStatus: "NEEDS_FIX",
            reviewerVerdict: "FAIL",
            checksState: "failed",
            blockerCount: 1,
            blockers: ["Missing acceptance coverage"],
            commentCount: 2,
            updatedAt: "2026-05-31T03:01:00.000Z",
            comments: [
              { id: "comment-1", author: "operator", message: "Please address blocker.", createdAt: "2026-05-31T02:20:00.000Z" },
              { id: "comment-2", author: "lead", message: "rerun reviewer", createdAt: "2026-05-31T03:00:00.000Z" }
            ],
            decision: {
              decision: "approved",
              author: "lead",
              note: "looks good",
              decidedAt: "2026-05-31T03:01:00.000Z"
            }
          }
        },
        "http://localhost:3000/settings": {
          settings: {
            version: 1,
            project: {
              activeProjectId: "default",
              defaultConfigPath: "/tmp/config.json",
              runsRoot: "/tmp/runs",
              defaultProvider: "opencode-local",
              defaultModel: "gpt-5.3-codex",
              defaultMode: "read-only"
            },
            retention: {
              evidenceDays: 14,
              artifactDays: 21
            },
            ui: {
              theme: "dark",
              keyboardShortcuts: false
            },
            updatedAt: "2026-05-31T03:02:00.000Z"
          }
        }
      },
      calls
    )
  });

  const result = await client.submitCommand(command, { confirmationContextId: "ctx-1" });
  const preview = await client.previewCommand(command);
  const commented = await client.addReviewComment("run-1", "rerun reviewer", "lead");
  const approved = await client.decideReview("run-1", "approved", "looks good", "lead");
  const settings = await client.updateSettings({
    project: {
      defaultProvider: "opencode-local",
      defaultMode: "read-only"
    },
    retention: {
      evidenceDays: 14,
      artifactDays: 21
    },
    ui: {
      theme: "dark",
      keyboardShortcuts: false
    }
  });

  assert.deepEqual(result, { ok: true, commandId: "cmd-1", type: "select-task", message: "Accepted" });
  assert.equal(preview.commandId, "cmd-1");
  assert.equal(commented.commentCount, 2);
  assert.equal(approved.status, "approved");
  assert.equal(settings.project.defaultProvider, "opencode-local");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.headers?.["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0]?.init?.body ?? "{}"), { command, options: { confirmationContextId: "ctx-1" } });
  assert.equal(calls[1]?.url, "http://localhost:3000/commands/preview");
  assert.equal(calls[4]?.init?.method, "PUT");
  assert.deepEqual(JSON.parse(calls[4]?.init?.body ?? "{}"), {
    settings: {
      project: {
        defaultProvider: "opencode-local",
        defaultMode: "read-only"
      },
      retention: {
        evidenceDays: 14,
        artifactDays: 21
      },
      ui: {
        theme: "dark",
        keyboardShortcuts: false
      }
    }
  });
});

test("MergeWrightApiClient executes audited flows through the API", async () => {
  const calls: Array<{ url: string; init?: Parameters<WebApiFetch>[1] }> = [];
  const contract: RunContract = {
    goal: "Validate audited flow client",
    workspace: "/tmp/workspace",
    flow: "feature-standard",
    stages: [{ id: "plan", kind: "plan", executor: "deterministic-dry-run" }]
  };
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch(
      {
        "http://localhost:3000/audited-flows?projectId=default": {
          run: auditedFlowResult
        }
      },
      calls
    )
  });

  const run = await client.executeAuditedFlow(contract, true, "default");

  assert.deepEqual(run, auditedFlowResult);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "http://localhost:3000/audited-flows?projectId=default");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[0]?.init?.body ?? "{}"), {
    contract,
    dryRun: true
  });
});

test("MergeWrightApiClient throws structured API errors", async () => {
  const client = new MergeWrightApiClient({
    baseUrl: "http://localhost:3000",
    fetch: createFetch({}, [])
  });

  await assert.rejects(() => client.getRun("missing"), (error) => {
    assert.ok(error instanceof WebApiError);
    assert.equal(error.status, 404);
    assert.deepEqual(error.payload, { code: "NOT_FOUND", message: "Missing" });
    return true;
  });
});

test("run view models prepare API data for the web shell", () => {
  assert.deepEqual(toRunListItemViewModel(runSummary), {
    id: "run-1",
    title: "Run one",
    subtitle: "In progress",
    status: "running",
    branchLabel: "feature/demo",
    modeLabel: "Read Only",
    warningCount: 1
  });

  assert.deepEqual(toRunDetailViewModel(runDetail), {
    id: "run-1",
    title: "Run one",
    status: "blocked",
    branchLabel: "No branch",
    modeLabel: "Auto Chain",
    phaseCount: 2,
    artifactCount: 1,
    reviewerFindingCount: 1,
    safeActionCount: 1,
    blockedReason: "Needs confirmation",
    phases: [
      {
        id: "planner",
        label: "Planner",
        status: "passed",
        summary: "Plan complete",
        artifactCount: 1,
        durationLabel: "1s",
        blockedReason: undefined
      },
      {
        id: "builder",
        label: "Builder",
        status: "blocked",
        summary: "No summary available",
        artifactCount: 0,
        durationLabel: "Not recorded",
        blockedReason: "Needs confirmation"
      }
    ]
  });
});
