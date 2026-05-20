import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { validateConfig, type OrchestratorConfig } from "../src/config.js";
import { checkWriteSafety, matchesBlockedPath, matchesSimplePattern, parseStatusPorcelainPaths } from "../src/write-safety.js";
import type { GitInspectionClient, GitInspectionResult } from "../src/git-inspection.js";

function makeConfig(overrides: Partial<OrchestratorConfig["writeSafety"]> = {}): OrchestratorConfig {
  const base = validateConfig({
    version: 1,
    projectName: "acme",
    workspaceRoot: "/tmp/workspace",
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
      allowedBranches: ["feature/*", "bugfix/*", "chore/*"],
      blockedPaths: [".git/", ".env", ".env.*", "*.p12", "*.mobileprovision", "fastlane/", "DistributionKit/"],
      requireCleanWorkingTree: true,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: true,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  });

  return {
    ...base,
    writeSafety: {
      ...base.writeSafety,
      ...overrides
    }
  };
}

function ok(stdout: string): GitInspectionResult {
  return { stdout, stderr: "", exitCode: 0, signal: null, success: true };
}

function fail(stderr = "error"): GitInspectionResult {
  return { stdout: "", stderr, exitCode: 1, signal: null, success: false };
}

function makeFakeGit(state: {
  inside?: GitInspectionResult;
  branch?: GitInspectionResult;
  status?: GitInspectionResult;
  names?: GitInspectionResult;
}): GitInspectionClient {
  return {
    isInsideWorkTree: async () => state.inside ?? ok("true\n"),
    currentBranch: async () => state.branch ?? ok("feature/new-thing\n"),
    statusPorcelain: async () => state.status ?? ok(""),
    diffNameOnly: async () => state.names ?? ok(""),
    diffStat: async () => ok(""),
    diffBinary: async () => ok("")
  };
}

test("passes with clean allowed branch and enabled true", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ enabled: true }),
    git: makeFakeGit({})
  });
  assert.equal(result.ok, true);
});

test("fails when writeSafety.enabled is false", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ enabled: false }),
    git: makeFakeGit({})
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("writeSafety.enabled is false")));
});

test("fails when not a git work tree", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig(),
    git: makeFakeGit({ inside: ok("false\n") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("not inside a git work tree")));
});

test("fails when branch is not allowed", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ allowedBranches: ["feature/*"] }),
    git: makeFakeGit({ branch: ok("main\n") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("does not match writeSafety.allowedBranches")));
});

test("fails when allowedBranches configured and branch is empty", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ allowedBranches: ["feature/*"] }),
    git: makeFakeGit({ branch: ok("") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("Current branch is unknown, but allowedBranches is configured."));
});

test("fails when allowedBranches configured and branch is whitespace", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ allowedBranches: ["feature/*"] }),
    git: makeFakeGit({ branch: ok("   \n") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("Current branch is unknown, but allowedBranches is configured."));
});

test("fails when working tree is dirty and requireCleanWorkingTree true", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ requireCleanWorkingTree: true }),
    git: makeFakeGit({ status: ok(" M src/app.ts\n") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("working tree is dirty")));
});

test("fails when changed file matches blocked path", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig(),
    git: makeFakeGit({ names: ok("fastlane/Fastfile\n") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("blockedPaths")));
});

test("allows dirty tree when requireCleanWorkingTree false and no blocked match", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ requireCleanWorkingTree: false }),
    git: makeFakeGit({ status: ok(" M src/app.ts\n"), names: ok("src/app.ts\n") })
  });
  assert.equal(result.ok, true);
});

test("blocked path from status porcelain only is detected", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig(),
    git: makeFakeGit({ status: ok(" M fastlane/Fastfile\n"), names: ok("") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("blockedPaths")));
});

test("untracked blocked path from status porcelain is detected", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig(),
    git: makeFakeGit({ status: ok("?? .env\n"), names: ok("") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.matchedBlockedPaths.some((m) => m.includes(".env -> .env")));
});

test("renamed or copied porcelain entry with blocked destination path is detected", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig(),
    git: makeFakeGit({ status: ok("R  src/app.ts -> fastlane/Fastfile\n"), names: ok("") })
  });
  assert.equal(result.ok, false);
  assert.ok(result.matchedBlockedPaths.some((m) => m.includes("fastlane/Fastfile -> fastlane/")));
});

test("changedFiles is union of diffNameOnly and status porcelain without duplicates", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const result = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ requireCleanWorkingTree: false, blockedPaths: [] }),
    git: makeFakeGit({
      status: ok(" M src/a.ts\n?? src/c.ts\n"),
      names: ok("src/a.ts\nsrc/b.ts\n")
    })
  });
  assert.deepEqual(result.changedFiles.sort(), ["src/a.ts", "src/b.ts", "src/c.ts"]);
});

test("non-git or unavailable inspection reports working tree state unknown", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "write-safety-"));
  const notGitResult = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig(),
    git: makeFakeGit({ inside: ok("false\n") })
  });
  assert.equal(notGitResult.workingTreeState, "unknown");

  const unavailableResult = await checkWriteSafety({
    workspaceRoot,
    config: makeConfig({ requireCleanWorkingTree: false }),
    git: makeFakeGit({ status: fail("status unavailable") })
  });
  assert.equal(unavailableResult.workingTreeState, "unknown");
});

test("branch wildcard matching works", () => {
  assert.equal(matchesSimplePattern("feature/new-ui", "feature/*"), true);
  assert.equal(matchesSimplePattern("bugfix/crash", "feature/*"), false);
  assert.equal(matchesSimplePattern("release/1.0", "release/1.0"), true);
});

test("blocked path wildcard and directory matching works", () => {
  assert.equal(matchesBlockedPath("fastlane/Fastfile", "fastlane/"), true);
  assert.equal(matchesBlockedPath("certs/dev.p12", "*.p12"), true);
  assert.equal(matchesBlockedPath(".env.local", ".env.*"), true);
  assert.equal(matchesBlockedPath("src/app.ts", "fastlane/"), false);
});

test("parseStatusPorcelainPaths handles common entries deterministically", () => {
  const paths = parseStatusPorcelainPaths(
    [" M path/file.ts", "M  path/file-2.ts", "A  path/new.ts", "?? path/untracked.ts", "R  old/path.ts -> new/path.ts", "C  old/copy.ts -> new/copy.ts", ""].join("\n")
  );
  assert.deepEqual(paths, [
    "path/file.ts",
    "path/file-2.ts",
    "path/new.ts",
    "path/untracked.ts",
    "old/path.ts",
    "new/path.ts",
    "old/copy.ts",
    "new/copy.ts"
  ]);
});
