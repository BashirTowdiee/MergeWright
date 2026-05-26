import test from "node:test";
import assert from "node:assert/strict";
import { createInitialRunMetadata } from "../src/run-metadata.js";
import { buildWriteAuditContext } from "../src/workflows/shared/write-audit-context.js";

function baseMetadata() {
  return createInitialRunMetadata({
    runId: "run-1",
    projectName: "Acme",
    stageName: "S1",
    workspaceRoot: "/tmp/workspace",
    orchestratorRoot: "/tmp/orchestrator",
    configPath: "/tmp/orchestrator/config.json",
    resolvedOptions: {
      dryRun: false,
      allowWrites: false,
      executePlanner: true,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false
    }
  });
}

test("buildWriteAuditContext reports no artefacts when nothing captured", () => {
  const metadata = baseMetadata();
  assert.equal(buildWriteAuditContext(metadata), "No write-audit artefacts available for reviewer context.");
});

test("buildWriteAuditContext aggregates and sorts captured artefacts", () => {
  const metadata = baseMetadata();
  metadata.writeAudit = {
    builder: {
      status: "captured",
      changedFiles: ["b.ts", "a.ts"],
      artefacts: ["write-audit/builder/summary.json", "write-audit/builder/post-diff.patch"]
    },
    fix: {
      status: "captured",
      changedFiles: ["a.ts", "c.ts"],
      artefacts: ["write-audit/fix/pre-diff-stat.txt", "write-audit/fix/summary.json"]
    }
  };

  const context = buildWriteAuditContext(metadata);
  assert.match(context, /Write-enabled phases executed: builder, fix/);
  assert.match(context, /Changed files from write audit: a\.ts, b\.ts, c\.ts/);
  assert.match(context, /write-audit\/builder\/summary\.json/);
  assert.match(context, /write-audit\/fix\/summary\.json/);
  assert.match(context, /Reviewer must inspect write-enabled changes using these artefacts\./);
});
