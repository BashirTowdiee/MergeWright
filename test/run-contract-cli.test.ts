import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs, runCommand } from "../src/cli-core.js";

test("run-contract parses goal flow and workspace flags", () => {
  const parsed = parseArgs(["run-contract", "--goal", "Add HN page", "--workspace", "/tmp/repo", "--flow", "feature-standard", "--dry-run"]);

  assert.equal(parsed.command, "run-contract");
  assert.equal(parsed.goalArg, "Add HN page");
  assert.equal(parsed.workspaceArg, "/tmp/repo");
  assert.equal(parsed.flowArg, "feature-standard");
  assert.equal(parsed.dryRun, true);
});

test("run-contract command returns deterministic dry-run output", async () => {
  const output: string[] = [];

  await runCommand(
    parseArgs(["run-contract", "--goal", "Add HN page", "--workspace", "/tmp/repo", "--dry-run"]),
    process.cwd(),
    "linux",
    async () => {},
    (line) => output.push(line),
    {
      runContractHandler: async ({ orchestratorRoot }) => ({
        runId: "audited-run-1",
        status: "passed",
        auditPath: `${orchestratorRoot}/.artifacts/runs/audited-flow/audited-run-1/audit.ndjson`,
        artefactsDir: `${orchestratorRoot}/.artifacts/runs/audited-flow/audited-run-1`,
        stageResults: [],
        dryRun: true
      })
    }
  );

  assert.deepEqual(output, [
    "audited flow run id: audited-run-1",
    "status: passed",
    `audit path: ${process.cwd()}/.artifacts/runs/audited-flow/audited-run-1/audit.ndjson`,
    `artefacts: ${process.cwd()}/.artifacts/runs/audited-flow/audited-run-1`
  ]);
});
