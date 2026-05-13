import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildProjectConfig, buildExampleStage, initProject, slugifyProjectName, validateProjectSlug } from "../src/init-project.js";

test("slugify Acme -> acme", () => {
  assert.equal(slugifyProjectName("Acme"), "acme");
});

test("slugify Gushi Studio -> gushi-studio", () => {
  assert.equal(slugifyProjectName("Gushi Studio"), "gushi-studio");
});

test("slugify my_app -> my-app", () => {
  assert.equal(slugifyProjectName("my_app"), "my-app");
});

test("invalid empty name fails", () => {
  assert.throws(() => validateProjectSlug(slugifyProjectName("   ")), /generated slug is empty/);
});

test("unsupported-only name fails", () => {
  assert.throws(() => validateProjectSlug(slugifyProjectName("!!!@@@")), /generated slug is empty/);
});

test("generated config paths use slug and absolute workspace", () => {
  const cfg = buildProjectConfig("My App", "my-app", "/tmp/workspace");
  assert.equal(cfg.paths.stagesDir, "stages/my-app");
  assert.equal(cfg.paths.runsDir, "runs/my-app");
  assert.equal(cfg.workspaceRoot, "/tmp/workspace");
  assert.deepEqual(cfg.commands.checks, []);
});

test("example stage is generic and not acme-specific", () => {
  const stage = buildExampleStage("My App", "my-app");
  assert.match(stage, /Replace this file with a real stage/);
  assert.match(stage, /Codex execution remains read-only/);
  assert.doesNotMatch(stage, /Acme/);
});

async function makeFixture(): Promise<{ orchestratorRoot: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-init-"));
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs"), { recursive: true });
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-workspace-"));
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  return { orchestratorRoot, workspaceRoot };
}

test("init-project creates config, stage, and runs gitkeep without writing workspace", async () => {
  const { orchestratorRoot, workspaceRoot } = await makeFixture();
  const result = await initProject({
    orchestratorRoot,
    projectName: "My App",
    workspaceArg: workspaceRoot,
    force: false,
    verbose: false
  });

  assert.equal(result.projectSlug, "my-app");
  await access(path.join(orchestratorRoot, "configs", "my-app.json"));
  await access(path.join(orchestratorRoot, "stages", "my-app", "example-stage.md"));
  await access(path.join(orchestratorRoot, "runs", "my-app", ".gitkeep"));
  await assert.rejects(access(path.join(workspaceRoot, "runs")));

  const cfgRaw = await readFile(path.join(orchestratorRoot, "configs", "my-app.json"), "utf8");
  const cfg = JSON.parse(cfgRaw) as { workspaceRoot: string; commands: { checks: unknown[] } };
  assert.equal(cfg.workspaceRoot, workspaceRoot);
  assert.deepEqual(cfg.commands.checks, []);
});

test("fails if workspace missing", async () => {
  const { orchestratorRoot } = await makeFixture();
  await assert.rejects(
    () =>
      initProject({
        orchestratorRoot,
        projectName: "My App",
        workspaceArg: path.join(orchestratorRoot, "missing"),
        force: false,
        verbose: false
      }),
    /Workspace path does not exist/
  );
});

test("fails if workspace is not a directory", async () => {
  const { orchestratorRoot } = await makeFixture();
  const filePath = path.join(orchestratorRoot, "workspace-file.txt");
  await writeFile(filePath, "x", "utf8");
  await assert.rejects(
    () => initProject({ orchestratorRoot, projectName: "My App", workspaceArg: filePath, force: false, verbose: false }),
    /not a directory/
  );
});

test("fails if workspace has no .git", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-init-"));
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs"), { recursive: true });
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-workspace-no-git-"));

  await assert.rejects(
    () => initProject({ orchestratorRoot, projectName: "No Git", workspaceArg: workspaceRoot, force: false, verbose: false }),
    /missing .*\.git/
  );
});

test("fails when generated files exist and force not provided", async () => {
  const { orchestratorRoot, workspaceRoot } = await makeFixture();
  await initProject({ orchestratorRoot, projectName: "My App", workspaceArg: workspaceRoot, force: false, verbose: false });
  await assert.rejects(
    () => initProject({ orchestratorRoot, projectName: "My App", workspaceArg: workspaceRoot, force: false, verbose: false }),
    /already exists/
  );
});

test("overwrites config and stage when --force is provided", async () => {
  const { orchestratorRoot, workspaceRoot } = await makeFixture();
  await initProject({ orchestratorRoot, projectName: "My App", workspaceArg: workspaceRoot, force: false, verbose: false });
  const stagePath = path.join(orchestratorRoot, "stages", "my-app", "example-stage.md");
  await writeFile(stagePath, "custom", "utf8");

  await initProject({ orchestratorRoot, projectName: "My App", workspaceArg: workspaceRoot, force: true, verbose: false });
  const stage = await readFile(stagePath, "utf8");
  assert.match(stage, /Replace this file with a real stage/);

  const runsStat = await stat(path.join(orchestratorRoot, "runs", "my-app"));
  assert.equal(runsStat.isDirectory(), true);
});

test("runs folder follows runs/<slug>", async () => {
  const { orchestratorRoot, workspaceRoot } = await makeFixture();
  await initProject({ orchestratorRoot, projectName: "Temp Project", workspaceArg: workspaceRoot, force: false, verbose: false });
  await access(path.join(orchestratorRoot, "runs", "temp-project", ".gitkeep"));
});
