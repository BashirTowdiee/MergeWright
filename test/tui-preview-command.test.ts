import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs, runCommand } from "../src/cli.js";
import type { RunMetadata } from "../src/run-metadata.js";

test("tui command renders the Ink TUI preview shell", async () => {
  const output: string[] = [];

  await runCommand(parseArgs(["tui"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));

  const text = output.join("\n");
  assert.match(text, /MergeWright TUI preview/);
  assert.match(text, /Framework: Ink/);
  assert.match(text, /Mode: read-only preview fixture/);
  assert.match(text, /MergeWright TUI spike/);
  assert.match(text, /Runs/);
  assert.match(text, /Phase flow/);
  assert.match(text, /Safe action/);
  assert.match(text, /Review findings/);
});

test("tui command renders real run data when config is provided", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "tui-config-run-list-"));
  const workspaceRoot = path.join(tmpDir, "workspace");
  const stagesDir = path.join(tmpDir, "stages");
  const promptsDir = path.join(tmpDir, "prompts");
  const runsDir = path.join(tmpDir, "runs");
  const runId = "20260520-000001-real-run";
  await mkdir(path.join(runsDir, runId), { recursive: true });
  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(stagesDir, { recursive: true });
  await mkdir(promptsDir, { recursive: true });

  const configPath = path.join(tmpDir, "config.json");
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 1,
        projectName: "Fixture Project",
        workspaceRoot,
        paths: { stagesDir, promptsDir, runsDir },
        executionBackends: { codex: { type: "codex-cli" } },
        agents: {
          planner: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" },
          builder: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" },
          reviewer: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: {
          requireGitRepo: false,
          requireCleanStart: false,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        },
        writeSafety: {
          enabled: false,
          allowedBranches: [],
          blockedPaths: [],
          requireCleanWorkingTree: false,
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

  const metadata: RunMetadata = {
    version: 1,
    runId,
    projectName: "Fixture Project",
    stageName: "real-stage",
    preset: "full-readonly",
    workspaceRoot,
    orchestratorRoot: tmpDir,
    configPath,
    startedAt: "2026-05-20T00:00:00.000Z",
    completedAt: "2026-05-20T00:01:00.000Z",
    status: "failed",
    resolvedOptions: {
      dryRun: false,
      allowWrites: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: true,
      planFix: false,
      executeFix: false,
      runChecks: false
    },
    postWriteReview: {
      required: false,
      status: "not-required",
      reason: "no writes",
      requiredByPhases: [],
      artefacts: []
    },
    phases: {
      planner: { status: "executed", artefacts: ["planner-output-last-message.md"] },
      builder: { status: "executed", artefacts: ["builder-output-last-message.md"] },
      reviewer: { status: "failed", artefacts: ["reviewer-output-last-message.md"] },
      fixPlanning: { status: "unknown" },
      fixExecution: { status: "unknown" },
      checks: { status: "unknown" }
    },
    artefacts: ["planner-output-last-message.md", "builder-output-last-message.md", "reviewer-output-last-message.md"],
    error: { message: "Reviewer found issue", failedPhase: "reviewer" }
  };
  await writeFile(path.join(runsDir, runId, "run.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await writeFile(path.join(runsDir, runId, "reviewer-output-last-message.md"), "- High: real finding\n", "utf8");

  const output: string[] = [];
  await runCommand(parseArgs(["tui", "--config", configPath]), tmpDir, "linux", async () => {}, (line) => output.push(line));

  const text = output.join("\n");
  assert.match(text, /MergeWright TUI run inspector/);
  assert.match(text, /Mode: read-only run data/);
  assert.match(text, /real-stage/);
  assert.match(text, /Reviewer found issue/);
  assert.match(text, /HIGH: High: real finding/);
});

test("tui command rejects repo and workspace flags", () => {
  assert.doesNotThrow(() => parseArgs(["tui", "--config", "configs/test.json"]));
  assert.throws(() => parseArgs(["tui", "--repo", "/tmp/repo"]), /tui does not accept --repo or --workspace/);
  assert.throws(() => parseArgs(["tui", "--workspace", "/tmp/repo"]), /tui does not accept --repo or --workspace/);
});
