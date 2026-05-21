import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { handleBackfillEvidenceCommand } from "../src/cli/commands/backfill-evidence.command.js";
import { NOOP_PROGRESS_LOGGER } from "../src/progress-logger.js";
import type { ParsedArgs } from "../src/cli.js";

function baseArgs(overrides: Partial<ParsedArgs>): ParsedArgs {
  return {
    command: "backfill-evidence",
    help: false,
    dryRun: false,
    verbose: false,
    force: false,
    configArg: undefined,
    repoOverride: undefined,
    workspaceArg: undefined,
    runId: undefined,
    ...overrides
  } as ParsedArgs;
}

async function runBackfillCommand(args: ParsedArgs, input: { orchestratorRoot?: string; output?: string[] } = {}): Promise<void> {
  await handleBackfillEvidenceCommand({
    args,
    orchestratorRoot: input.orchestratorRoot ?? "/tmp/orchestrator",
    platform: "darwin",
    openRunDirectory: async () => {},
    writeLine: (line) => input.output?.push(line),
    deps: {},
    progressLogger: NOOP_PROGRESS_LOGGER
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function createBackfillFixture(): Promise<{ orchestratorRoot: string; runId: string; runDir: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "backfill-command-"));
  const workspaceRoot = path.join(orchestratorRoot, "workspace");
  const runsDir = path.join(orchestratorRoot, "runs");
  const runId = "20260521-010000-example";
  const runDir = path.join(runsDir, runId);

  await mkdir(workspaceRoot, { recursive: true });
  await mkdir(runDir, { recursive: true });
  await writeJson(path.join(orchestratorRoot, "config.json"), {
    version: 1,
    projectName: "MergeWright",
    workspaceRoot,
    paths: {
      stagesDir: "stages",
      promptsDir: "prompts",
      runsDir: "runs"
    },
    executionBackends: {
      codex: { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.5", reasoningEffort: "medium" },
      builder: { backend: "codex", model: "gpt-5.5", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.5", reasoningEffort: "medium" }
    },
    pipeline: {
      finalReview: true,
      maxFixLoops: 1
    },
    commands: {
      checks: []
    },
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
      captureDiffBeforeAfter: false,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  });
  await writeJson(path.join(runDir, "run.json"), {
    version: 1,
    runId,
    projectName: "MergeWright",
    stageName: "Example",
    workspaceRoot,
    orchestratorRoot,
    configPath: path.join(orchestratorRoot, "config.json"),
    startedAt: "2026-05-21T01:00:00.000Z",
    completedAt: "2026-05-21T01:01:00.000Z",
    status: "success",
    resolvedOptions: {},
    phases: {},
    artefacts: [],
    postWriteReview: { required: false, status: "not-required", reason: "none", requiredByPhases: [], artefacts: [] },
    error: null
  });

  return { orchestratorRoot, runId, runDir };
}

test("handleBackfillEvidenceCommand rejects missing config", async () => {
  await assert.rejects(
    () => runBackfillCommand(baseArgs({ runId: "run-123" })),
    /Missing required --config <config-path>/
  );
});

test("handleBackfillEvidenceCommand rejects missing run id", async () => {
  await assert.rejects(
    () => runBackfillCommand(baseArgs({ configArg: "configs/project.json" })),
    /Usage: agent-stage backfill-evidence <run-id>/
  );
});

test("handleBackfillEvidenceCommand previews dry-run output without writing evidence", async () => {
  const { orchestratorRoot, runId, runDir } = await createBackfillFixture();
  try {
    const output: string[] = [];

    await runBackfillCommand(
      baseArgs({ configArg: "config.json", runId, dryRun: true }),
      { orchestratorRoot, output }
    );

    assert.deepEqual(output, [
      `Evidence backfill previewed: ${runId}`,
      "Status: pass",
      "Changed files: 0",
      "Untracked files: 0",
      "Missing artefacts: 4",
      "Malformed artefacts: 0"
    ]);
    await assert.rejects(() => readFile(path.join(runDir, "evidence.json"), "utf8"));
  } finally {
    await rm(orchestratorRoot, { recursive: true, force: true });
  }
});

test("handleBackfillEvidenceCommand writes evidence in run directory", async () => {
  const { orchestratorRoot, runId, runDir } = await createBackfillFixture();
  try {
    const output: string[] = [];

    await runBackfillCommand(baseArgs({ configArg: "config.json", runId }), { orchestratorRoot, output });

    assert.deepEqual(output, [
      `Evidence backfill written: ${runId}`,
      "Status: pass",
      "Changed files: 0",
      "Untracked files: 0",
      "Missing artefacts: 4",
      "Malformed artefacts: 0"
    ]);
    const evidence = JSON.parse(await readFile(path.join(runDir, "evidence.json"), "utf8")) as { runId: string; status: string };
    assert.equal(evidence.runId, runId);
    assert.equal(evidence.status, "pass");
  } finally {
    await rm(orchestratorRoot, { recursive: true, force: true });
  }
});
