import assert from "node:assert/strict";
import test from "node:test";
import { createInitialClassicRunEvidenceManifest } from "../src/workflows/classic-run/run-evidence.js";
import type { ClassicRunContext } from "../src/workflows/classic-run/run-context.js";

function makeContext(): ClassicRunContext {
  return {
    orchestratorRoot: "/repo/orchestrator",
    configPath: "/repo/orchestrator/configs/acme.json",
    config: {
      version: 1,
      projectName: "Acme",
      workspaceRoot: "/repo/workspace",
      paths: {
        stagesDir: "stages/acme",
        promptsDir: "prompts",
        runsDir: "runs/acme"
      },
      executionBackends: {
        codex: { type: "codex-cli" }
      },
      agents: {
        planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" },
        builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
        reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" }
      },
      pipeline: { finalReview: true, maxFixLoops: 1 },
      commands: { checks: [] },
      safety: {
        requireGitRepo: true,
        requireCleanStart: true,
        manualCommit: true,
        forbidAutoCommit: true,
        forbidAutoPush: true
      },
      writeSafety: {
        enabled: true,
        allowedBranches: [],
        blockedPaths: [],
        requireCleanWorkingTree: true,
        requireExplicitAllowWrites: true,
        captureDiffBeforeAfter: true,
        requireReviewAfterWrites: true,
        autoCommit: false,
        autoPush: false
      }
    },
    executor: async () => ({
      command: "codex",
      args: [],
      cwd: "/repo/workspace",
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 0,
      outputLastMessagePath: "",
      outputLastMessage: "",
      skipped: true,
      success: true
    }),
    targetWorkspaceRoot: "/repo/workspace",
    stagesDir: "/repo/orchestrator/stages/acme",
    promptsDir: "/repo/orchestrator/prompts",
    runsBaseDir: "/repo/orchestrator/runs/acme",
    stagePath: "/repo/orchestrator/stages/acme/example-stage.md",
    stageInstruction: "Stage instruction",
    templates: {},
    timestamp: "20260521-123456",
    runId: "20260521-123456-example-stage",
    runDir: "/repo/orchestrator/runs/acme/20260521-123456-example-stage",
    variables: {
      stage_name: "example-stage",
      stage_instruction: "Stage instruction",
      timestamp: "20260521-123456",
      workspace_root: "/repo/workspace",
      run_dir: "/repo/orchestrator/runs/acme/20260521-123456-example-stage",
      git_status: "",
      builder_output: "",
      test_output: "",
      git_diff: "",
      review_output: ""
    }
  };
}

test("createInitialClassicRunEvidenceManifest maps classic run context into evidence defaults", () => {
  const evidence = createInitialClassicRunEvidenceManifest(makeContext());

  assert.equal(evidence.version, 1);
  assert.equal(evidence.runId, "20260521-123456-example-stage");
  assert.equal(evidence.projectName, "Acme");
  assert.equal(evidence.stageName, "example-stage");
  assert.equal(evidence.workspace, "/repo/workspace");
  assert.equal(evidence.status, "in_progress");
  assert.deepEqual(evidence.git, {
    changedFiles: [],
    untrackedFiles: [],
    unexpectedFiles: []
  });
  assert.deepEqual(evidence.commands, []);
  assert.deepEqual(evidence.artefacts, []);
});
