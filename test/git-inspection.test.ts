import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildGitInspectionCommand, createGitInspectionClient, spawnGitInspectionCommand } from "../src/git-inspection.js";

test("buildGitInspectionCommand maps only allowed read-only commands", () => {
  assert.deepEqual(buildGitInspectionCommand("isInsideWorkTree"), {
    command: "git",
    args: ["rev-parse", "--is-inside-work-tree"]
  });
  assert.deepEqual(buildGitInspectionCommand("currentBranch"), {
    command: "git",
    args: ["branch", "--show-current"]
  });
  assert.deepEqual(buildGitInspectionCommand("statusPorcelain"), {
    command: "git",
    args: ["status", "--porcelain"]
  });
  assert.deepEqual(buildGitInspectionCommand("diffNameOnly"), {
    command: "git",
    args: ["diff", "--name-only"]
  });
  assert.deepEqual(buildGitInspectionCommand("diffStat"), {
    command: "git",
    args: ["diff", "--stat"]
  });
  assert.deepEqual(buildGitInspectionCommand("diffBinary"), {
    command: "git",
    args: ["diff", "--binary"]
  });
});

test("executor seam can be injected without real git", async () => {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const fakeExecutor = async (command: string, args: string[], cwd: string) => {
    calls.push({ command, args, cwd });
    return { stdout: "ok\n", stderr: "", exitCode: 0, signal: null, success: true };
  };

  const git = createGitInspectionClient(fakeExecutor);
  await git.currentBranch("/tmp/work");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "git");
  assert.deepEqual(calls[0].args, ["branch", "--show-current"]);
  assert.equal(calls[0].cwd, "/tmp/work");
});

test("mutation commands are not exposed by inspection client API", () => {
  const git = createGitInspectionClient(async () => ({
    stdout: "",
    stderr: "",
    exitCode: 0,
    signal: null,
    success: true
  }));

  const keys = Object.keys(git).sort();
  assert.deepEqual(keys, ["currentBranch", "diffBinary", "diffNameOnly", "diffStat", "isInsideWorkTree", "statusPorcelain"]);
});

test("spawnGitInspectionCommand uses non-shell spawn with captured stdio", async () => {
  const calls: Array<{ command: string; args: string[]; options: { shell: boolean; stdio: string } }> = [];
  const spawnImpl = ((command: string, args: string[], options: { shell: boolean; stdio: string }) => {
    calls.push({ command, args, options });
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      child.stdout.emit("data", "true\n");
      child.emit("close", 0, null);
    });
    return child;
  }) as unknown as Parameters<typeof spawnGitInspectionCommand>[3];

  const result = await spawnGitInspectionCommand("git", ["status", "--porcelain"], "/tmp/work", spawnImpl);
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.stdio, "pipe");
});
