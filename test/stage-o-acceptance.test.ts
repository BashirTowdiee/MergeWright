import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs, runCommand } from "../src/cli.js";

async function writePromptTemplates(orchestratorRoot: string): Promise<void> {
  const promptsDir = path.join(orchestratorRoot, "prompts");
  await mkdir(promptsDir, { recursive: true });
  await writeFile(path.join(promptsDir, "planner-stage.md"), "{{stage_name}}\n{{stage_instruction}}", "utf8");
  await writeFile(path.join(promptsDir, "reviewer.md"), "{{planner_output}}\n{{builder_execution_state}}", "utf8");
  await writeFile(path.join(promptsDir, "review-to-fix.md"), "{{review_output}}", "utf8");
  await writeFile(path.join(promptsDir, "final-review.md"), "{{review_output}}", "utf8");
}

async function makeAcceptanceFixture(): Promise<{ orchestratorRoot: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-stage-o-"));
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs"), { recursive: true });
  await writePromptTemplates(orchestratorRoot);

  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-workspace-stage-o-"));
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  return { orchestratorRoot, workspaceRoot };
}

async function readRunId(orchestratorRoot: string, slug: string): Promise<string> {
  const runsRoot = path.join(orchestratorRoot, "runs", slug);
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^\d{8}-\d{6}-/.test(name));
  assert.equal(runIds.length, 1, "expected exactly one generated run directory");
  return runIds[0] as string;
}

test("Stage O acceptance: init, run dry-run, list/show, continue dry-run, open-run seam", async () => {
  const { orchestratorRoot, workspaceRoot } = await makeAcceptanceFixture();
  const output: string[] = [];

  await runCommand(
    parseArgs(["init-project", "MyApp", "--workspace", workspaceRoot]),
    orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );

  const configArg = "configs/myapp.json";
  await runCommand(
    parseArgs(["run", "example-stage", "--config", configArg, "--preset", "full-readonly", "--dry-run"]),
    orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );

  const runId = await readRunId(orchestratorRoot, "myapp");
  const runDir = path.join(orchestratorRoot, "runs", "myapp", runId);
  const runJsonPath = path.join(runDir, "run.json");

  const runJson = JSON.parse(await readFile(runJsonPath, "utf8")) as {
    resolvedOptions: { dryRun: boolean; executePlanner: boolean; executeBuilder: boolean; executeReviewer: boolean; planFix: boolean; executeFix: boolean; runChecks: boolean };
    phases: { planner: { status: string }; builder: { status: string } };
  };
  assert.equal(runJson.resolvedOptions.dryRun, true);
  assert.equal(runJson.resolvedOptions.executePlanner, true);
  assert.equal(runJson.resolvedOptions.executeBuilder, true);
  assert.equal(runJson.resolvedOptions.executeReviewer, true);
  assert.equal(runJson.resolvedOptions.planFix, true);
  assert.equal(runJson.resolvedOptions.executeFix, true);
  assert.equal(runJson.resolvedOptions.runChecks, true);
  assert.equal(runJson.phases.planner.status, "skipped");
  assert.equal(runJson.phases.builder.status, "skipped");

  const listOutput: string[] = [];
  await runCommand(parseArgs(["list-runs", "--config", configArg]), orchestratorRoot, "linux", async () => {}, (line) =>
    listOutput.push(line)
  );
  assert.ok(listOutput.some((line) => line.includes(runId)));

  const showOutput: string[] = [];
  await runCommand(
    parseArgs(["show-run", runId, "--config", configArg]),
    orchestratorRoot,
    "linux",
    async () => {},
    (line) => showOutput.push(line)
  );
  assert.ok(showOutput.some((line) => line.includes(`run id: ${runId}`)));
  assert.ok(showOutput.some((line) => line.includes("status:")));

  const continuationRunId = "20260513-120000-example-stage-cont";
  const continuationRunDir = path.join(orchestratorRoot, "runs", "myapp", continuationRunId);
  await mkdir(continuationRunDir, { recursive: true });
  await writeFile(path.join(continuationRunDir, "builder-prompt.extracted.md"), "builder prompt", "utf8");
  await writeFile(path.join(continuationRunDir, "01-stage-input.md"), "stage", "utf8");
  await writeFile(path.join(continuationRunDir, "06-planner-output-last-message.md"), "planner", "utf8");
  await writeFile(
    path.join(continuationRunDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: continuationRunId,
        projectName: "MyApp",
        stageName: "example-stage",
        workspaceRoot,
        orchestratorRoot,
        configPath: path.join(orchestratorRoot, configArg),
        startedAt: "2026-05-13T00:00:00.000Z",
        completedAt: "2026-05-13T00:00:01.000Z",
        status: "success",
        resolvedOptions: {
          dryRun: false,
          executePlanner: true,
          executeBuilder: false,
          executeReviewer: false,
          planFix: false,
          executeFix: false,
          runChecks: false
        },
        phases: {
          planner: { status: "executed" },
          builder: { status: "disabled" },
          reviewer: { status: "disabled" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "disabled" }
        },
        artefacts: ["01-stage-input.md", "06-planner-output-last-message.md", "builder-prompt.extracted.md"],
        error: null
      },
      null,
      2
    ),
    "utf8"
  );

  const beforeContinue = await readFile(path.join(continuationRunDir, "run.json"), "utf8");
  await runCommand(
    parseArgs(["continue-run", continuationRunId, "--config", configArg, "--execute-builder", "--dry-run"]),
    orchestratorRoot,
    "linux",
    async () => {},
    () => {}
  );
  const afterContinue = await readFile(path.join(continuationRunDir, "run.json"), "utf8");
  assert.equal(afterContinue, beforeContinue);

  let openedRunDir = "";
  await runCommand(
    parseArgs(["open-run", runId, "--config", configArg]),
    orchestratorRoot,
    "darwin",
    async (dir) => {
      openedRunDir = dir;
    },
    () => {}
  );
  assert.equal(openedRunDir, runDir);

  assert.equal(output.some((line) => line.includes("Project initialization summary")), true);
  assert.equal(output.some((line) => line.includes("Run summary")), true);
});
