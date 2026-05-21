import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readEvidenceManifest } from "../src/evidence/evidence-store.js";
import { runStage } from "../src/runner.js";

async function makeFixture(): Promise<{ orchestratorRoot: string; configPath: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-evidence-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-evidence-"));

  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "prompts"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });

  await writeFile(path.join(orchestratorRoot, "stages/acme/example-stage.md"), "Stage instruction", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/planner-stage.md"), "{{stage_name}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/reviewer.md"), "{{planner_output}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/review-to-fix.md"), "{{review_output}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/final-review.md"), "{{review_output}}", "utf8");

  const configPath = path.join(orchestratorRoot, "configs/acme.json");
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 1,
        projectName: "Acme",
        workspaceRoot,
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
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
      null,
      2
    ),
    "utf8"
  );

  return { orchestratorRoot, configPath, workspaceRoot };
}

test("classic run setup writes evidence.json", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: false,
    executeBuilder: false,
    verbose: false,
    orchestratorRoot,
    preset: "full-readonly"
  });

  const evidence = await readEvidenceManifest(result.runDir);
  assert.equal(evidence.runId, path.basename(result.runDir));
  assert.equal(evidence.projectName, "Acme");
  assert.equal(evidence.stageName, "example-stage");
  assert.equal(evidence.workspace, workspaceRoot);
  assert.equal(evidence.status, "in_progress");
  assert.deepEqual(evidence.git, {
    changedFiles: [],
    untrackedFiles: [],
    unexpectedFiles: []
  });
});
