import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStage } from "../src/runner.js";

async function makeFixture(): Promise<{ orchestratorRoot: string; configPath: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-meta-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-meta-"));

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
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: {
          requireGitRepo: true,
          requireCleanStart: true,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        }
      },
      null,
      2
    ),
    "utf8"
  );

  return { orchestratorRoot, configPath, workspaceRoot };
}

async function makeFakeCodexBinary(binDir: string): Promise<void> {
  const codexPath = path.join(binDir, "codex");
  await writeFile(
    codexPath,
    `#!/usr/bin/env bash
set -euo pipefail
OUT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      OUT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
cat >/dev/null
if [[ "$OUT" == *"review-to-fix-output-last-message.md" ]]; then
  printf "## DECISION\\nFIX_REQUIRED\\n\\n## RATIONALE\\nneeds fix\\n\\n## FINAL FIX PROMPT\\nApply fix\\n" > "$OUT"
elif [[ "$OUT" == *"planner-output-last-message.md" ]]; then
  printf "## DECISION\\nBUILD\\n\\n## FINAL BUILDER PROMPT\\nImplement\\n" > "$OUT"
else
  printf "ok\\n" > "$OUT"
fi
printf "fake-codex-stdout\\n"
`,
    "utf8"
  );
  await chmod(codexPath, 0o755);
}

test("every run writes run.json", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
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
  const runMetadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as { status: string };
  assert.equal(runMetadata.status, "success");
});

test("dry-run metadata marks skipped phases and success", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    runChecks: true,
    verbose: false,
    orchestratorRoot
  });
  const runMetadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    phases: Record<string, { status: string }>;
    status: string;
  };
  assert.equal(runMetadata.status, "success");
  assert.equal(runMetadata.phases.planner.status, "skipped");
  assert.equal(runMetadata.phases.builder.status, "skipped");
  assert.equal(runMetadata.phases.reviewer.status, "skipped");
  assert.equal(runMetadata.phases.fixPlanning.status, "skipped");
  assert.equal(runMetadata.phases.fixExecution.status, "skipped");
  assert.equal(runMetadata.phases.checks.status, "skipped");
});

test("executed phase metadata includes backend metadata when adapter provides it", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const binDir = await mkdtemp(path.join(os.tmpdir(), "runner-meta-codex-bin-"));
  await makeFakeCodexBinary(binDir);
  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  let result: Awaited<ReturnType<typeof runStage>> | undefined;
  try {
    result = await runStage({
      stageName: "example-stage",
      configArg: path.relative(orchestratorRoot, configPath),
      dryRun: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: true,
      planFix: true,
      executeFix: true,
      verbose: false,
      orchestratorRoot
    });
  } finally {
    process.env.PATH = originalPath;
  }
  assert.ok(result);
  const runMetadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    phases: Record<string, { status: string; backend?: { backendType: string } }>;
  };
  assert.equal(runMetadata.phases.planner.status, "executed");
  assert.equal(runMetadata.phases.builder.status, "executed");
  assert.equal(runMetadata.phases.reviewer.status, "executed");
  assert.equal(runMetadata.phases.fixPlanning.status, "executed");
  assert.equal(runMetadata.phases.fixExecution.status, "executed");
  assert.equal(runMetadata.phases.planner.backend?.backendType, "codex-cli");
  assert.equal(runMetadata.phases.builder.backend?.backendType, "codex-cli");
  assert.equal(runMetadata.phases.reviewer.backend?.backendType, "codex-cli");
  assert.equal(runMetadata.phases.fixPlanning.backend?.backendType, "codex-cli");
  assert.equal(runMetadata.phases.fixExecution.backend?.backendType, "codex-cli");
});

test("metadata does not invent backend metadata when explicit codexExecutor override returns no backend", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: false,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => ({
      command: "override",
      args: [],
      cwd: orchestratorRoot,
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 1,
      success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\noverride prompt",
      skipped: false
    })
  });
  const runMetadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    phases: Record<string, { status: string; backend?: unknown }>;
  };
  assert.equal(runMetadata.phases.planner.status, "executed");
  assert.equal(runMetadata.phases.planner.backend, undefined);
});

test("builder failure marks run failed with failed phase", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex",
              args: [],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "boom",
            exitCode: 2,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "",
            skipped: false
          };
        }
      }),
    /Builder execution failed/
  );

  const runsDir = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await (await import("node:fs/promises")).readdir(runsDir);
  const runMetadata = JSON.parse(await readFile(path.join(runsDir, runId, "run.json"), "utf8")) as {
    status: string;
    error: { failedPhase?: string; message: string };
  };
  assert.equal(runMetadata.status, "failed");
  assert.equal(runMetadata.error.failedPhase, "builder");
  assert.match(runMetadata.error.message, /Builder execution failed/);
});

test("builder failure preserves original error when failure-phase metadata persist fails", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let failedMetadataWriteInjected = false;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex",
              args: [],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "boom",
            exitCode: 2,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "",
            skipped: false
          };
        },
        metadataWriter: async (_runDir, metadata) => {
          const builderFailed = metadata.phases.builder.status === "failed";
          if (builderFailed && !failedMetadataWriteInjected) {
            failedMetadataWriteInjected = true;
            throw new Error("metadata write failure (injected)");
          }
          await writeFile(path.join(_runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
        }
      }),
    (error) => {
      assert.equal(error instanceof Error, true);
      const message = (error as Error).message;
      assert.match(message, /Builder execution failed/);
      assert.doesNotMatch(message, /metadata write failure/);
      return true;
    }
  );
});

test("checks failure preserves original error when failure-phase metadata persist fails", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    commands: { checks: Array<{ name: string; command: string; args: string[]; cwd: string }> };
  };
  config.commands.checks = [{ name: "dummy", command: "echo", args: ["ok"], cwd: "workspace" }];
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  let failedMetadataWriteInjected = false;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        runChecks: true,
        verbose: false,
        orchestratorRoot,
        checkCommandExecutor: async () => ({
          name: "dummy",
          command: "echo",
          args: ["ok"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "boom",
          exitCode: 3,
          signal: null,
          durationMs: 1,
          success: false
        }),
        metadataWriter: async (_runDir, metadata) => {
          const checksFailed = metadata.phases.checks.status === "failed";
          if (checksFailed && !failedMetadataWriteInjected) {
            failedMetadataWriteInjected = true;
            throw new Error("metadata write failure (injected)");
          }
          await writeFile(path.join(_runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
        }
      }),
    (error) => {
      assert.equal(error instanceof Error, true);
      const message = (error as Error).message;
      assert.match(message, /Checks failed/);
      assert.doesNotMatch(message, /metadata write failure/);
      return true;
    }
  );
});
