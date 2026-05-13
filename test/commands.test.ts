import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { executeCheckCommand, validateConfiguredCheckCommand } from "../src/commands.js";
import type { ConfiguredCheckCommand } from "../src/config.js";

test("command validation rejects git mutations behind global options", () => {
  const cases: ConfiguredCheckCommand[] = [
    { name: "git-c-commit", command: "git", args: ["-C", ".", "commit"], cwd: "workspace" },
    { name: "git-config-commit", command: "git", args: ["-c", "user.name=test", "commit"], cwd: "workspace" },
    { name: "git-dir-push", command: "git", args: ["--git-dir", ".git", "push"], cwd: "workspace" }
  ];
  for (const command of cases) {
    assert.throws(() => validateConfiguredCheckCommand(command), /denied git subcommand/);
  }
});

test("command validation rejects shell trampoline executables", () => {
  const cases: ConfiguredCheckCommand[] = [
    { name: "bash-lc", command: "bash", args: ["-lc", "git commit -m test"], cwd: "workspace" },
    { name: "sh-c", command: "sh", args: ["-c", "rm -rf /tmp/foo"], cwd: "workspace" },
    { name: "zsh-lc", command: "zsh", args: ["-lc", "echo hi"], cwd: "workspace" },
    { name: "pwsh-command", command: "pwsh", args: ["-Command", "git push"], cwd: "workspace" }
  ];
  for (const command of cases) {
    assert.throws(() => validateConfiguredCheckCommand(command), /is denied/);
  }
});

test("command validation rejects executable-path and env indirection bypasses", () => {
  const cases: ConfiguredCheckCommand[] = [
    { name: "bin-bash-lc", command: "/bin/bash", args: ["-lc", "git commit -m test"], cwd: "workspace" },
    { name: "usr-bin-bash-lc", command: "/usr/bin/bash", args: ["-lc", "echo hi"], cwd: "workspace" },
    { name: "bin-sh-c", command: "/bin/sh", args: ["-c", "rm -rf /tmp/foo"], cwd: "workspace" },
    { name: "usr-bin-git-commit", command: "/usr/bin/git", args: ["commit"], cwd: "workspace" },
    { name: "usr-bin-git-c-commit", command: "/usr/bin/git", args: ["-C", ".", "commit"], cwd: "workspace" },
    { name: "env-bash", command: "env", args: ["bash", "-lc", "echo hi"], cwd: "workspace" },
    { name: "usr-bin-env-bash", command: "/usr/bin/env", args: ["bash", "-lc", "echo hi"], cwd: "workspace" },
    { name: "env-git-commit", command: "env", args: ["git", "commit"], cwd: "workspace" },
    { name: "usr-bin-env-git-c-commit", command: "/usr/bin/env", args: ["git", "-C", ".", "commit"], cwd: "workspace" },
    { name: "env-rm-rf", command: "env", args: ["rm", "-rf", "/tmp/foo"], cwd: "workspace" }
  ];
  for (const command of cases) {
    assert.throws(() => validateConfiguredCheckCommand(command));
  }
});

test("command validation rejects dangerous rm/chmod/chown recursive variants", () => {
  const cases: ConfiguredCheckCommand[] = [
    { name: "rm-fr", command: "rm", args: ["-fr", "/tmp/foo"], cwd: "workspace" },
    { name: "rm-Rf", command: "rm", args: ["-Rf", "/tmp/foo"], cwd: "workspace" },
    { name: "rm-recursive", command: "rm", args: ["--recursive", "/tmp/foo"], cwd: "workspace" },
    { name: "rm-force", command: "rm", args: ["--force", "/tmp/foo"], cwd: "workspace" },
    { name: "chmod-R", command: "chmod", args: ["-R", "777", "/tmp/foo"], cwd: "workspace" },
    { name: "chown-R", command: "chown", args: ["-R", "user", "/tmp/foo"], cwd: "workspace" }
  ];
  for (const command of cases) {
    assert.throws(() => validateConfiguredCheckCommand(command));
  }
});

test("command validation allows safe git read-only commands", () => {
  const cases: ConfiguredCheckCommand[] = [
    { name: "git-status", command: "git", args: ["status"], cwd: "workspace" },
    { name: "git-C-status", command: "git", args: ["-C", ".", "status"], cwd: "workspace" },
    { name: "git-diff", command: "git", args: ["diff"], cwd: "workspace" },
    { name: "usr-bin-git-status", command: "/usr/bin/git", args: ["status"], cwd: "workspace" },
    { name: "usr-bin-git-C-status", command: "/usr/bin/git", args: ["-C", ".", "status"], cwd: "workspace" }
  ];
  for (const command of cases) {
    assert.doesNotThrow(() => validateConfiguredCheckCommand(command));
  }
});

test("command validation allows npm test", () => {
  const command: ConfiguredCheckCommand = { name: "unit-tests", command: "npm", args: ["test"], cwd: "workspace" };
  assert.doesNotThrow(() => validateConfiguredCheckCommand(command));
});

test("command validation allows xcodebuild -version", () => {
  const command: ConfiguredCheckCommand = { name: "xcodebuild-version", command: "xcodebuild", args: ["-version"], cwd: "workspace" };
  assert.doesNotThrow(() => validateConfiguredCheckCommand(command));
});

test("executeCheckCommand uses shell false and captures outputs", async () => {
  const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
  const spawnStub = ((command: string, args: string[], options: Record<string, unknown>) => {
    calls.push({ command, args, options });
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      child.stdout.emit("data", "ok-out");
      child.stderr.emit("data", "ok-err");
      child.emit("close", 0, null);
    });
    return child;
  }) as never;

  const result = await executeCheckCommand(
    { name: "unit-tests", command: "npm", args: ["test"], cwd: "/tmp/workspace" },
    spawnStub
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.options.shell, false);
  assert.equal(calls[0]?.options.stdio, "pipe");
  assert.equal(result.stdout, "ok-out");
  assert.equal(result.stderr, "ok-err");
  assert.equal(result.exitCode, 0);
  assert.equal(result.success, true);
});
