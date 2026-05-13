import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitInspectionClient, type GitInspectionClient, type GitInspectionResult } from "./git-inspection.js";
import { parseStatusPorcelainPaths } from "./write-safety.js";

export type WriteAuditPhase = "builder" | "fix";

interface WriteAuditSnapshot {
  status: GitInspectionResult;
  diffStat: GitInspectionResult;
  diffBinary: GitInspectionResult;
  diffNameOnly: GitInspectionResult;
}

export interface WriteAuditResult {
  phase: WriteAuditPhase;
  trackedDiffPatchArtefact: string;
  note: string;
  pre: {
    status: string;
    diffStat: string;
    diffPath: string;
    changedFiles: string[];
    statusOnlyFiles: string[];
    untrackedFiles: string[];
  };
  post: {
    status: string;
    diffStat: string;
    diffPath: string;
    changedFiles: string[];
    statusOnlyFiles: string[];
    untrackedFiles: string[];
  };
  changedFilesAddedByPhase: string[];
  artefacts: string[];
}

export interface WriteAuditCapture {
  phase: WriteAuditPhase;
  workspaceRoot: string;
  pre: WriteAuditSnapshot;
}

export async function captureWriteAuditPreState(params: {
  phase: WriteAuditPhase;
  workspaceRoot: string;
  git?: GitInspectionClient;
}): Promise<WriteAuditCapture> {
  const git = params.git ?? createGitInspectionClient();
  const pre = await captureSnapshot(git, params.workspaceRoot, `pre-${params.phase}`);
  return {
    phase: params.phase,
    workspaceRoot: params.workspaceRoot,
    pre
  };
}

export async function captureWriteAuditPostStateAndWriteArtefacts(params: {
  runDir: string;
  capture: WriteAuditCapture;
  git?: GitInspectionClient;
}): Promise<WriteAuditResult> {
  const git = params.git ?? createGitInspectionClient();
  const post = await captureSnapshot(git, params.capture.workspaceRoot, `post-${params.capture.phase}`);

  const preDiffChanged = parseChangedFiles(params.capture.pre.diffNameOnly.stdout);
  const postDiffChanged = parseChangedFiles(post.diffNameOnly.stdout);
  const preStatusChanged = uniqueSorted(parseStatusPorcelainPaths(params.capture.pre.status.stdout));
  const postStatusChanged = uniqueSorted(parseStatusPorcelainPaths(post.status.stdout));
  const preChanged = uniqueSorted([...preDiffChanged, ...preStatusChanged]);
  const postChanged = uniqueSorted([...postDiffChanged, ...postStatusChanged]);
  const preStatusOnlyFiles = preChanged.filter((file) => !preDiffChanged.includes(file));
  const postStatusOnlyFiles = postChanged.filter((file) => !postDiffChanged.includes(file));
  const preUntrackedFiles = parseUntrackedPaths(params.capture.pre.status.stdout);
  const postUntrackedFiles = parseUntrackedPaths(post.status.stdout);
  const changedFilesAddedByPhase = postChanged.filter((file) => !preChanged.includes(file));

  const relBase = path.posix.join("write-audit", params.capture.phase);
  const absBase = path.resolve(params.runDir, relBase);
  await mkdir(absBase, { recursive: true });

  const preDiffPath = path.posix.join(relBase, "pre-diff.patch");
  const postDiffPath = path.posix.join(relBase, "post-diff.patch");

  const artefacts: string[] = [];
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "pre-status.txt"), params.capture.pre.status.stdout));
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "pre-diff-stat.txt"), params.capture.pre.diffStat.stdout));
  artefacts.push(await writeArtefact(params.runDir, preDiffPath, params.capture.pre.diffBinary.stdout));
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "pre-changed-files.json"), json(preChanged)));
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "pre-untracked-files.json"), json(preUntrackedFiles)));

  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "post-status.txt"), post.status.stdout));
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "post-diff-stat.txt"), post.diffStat.stdout));
  artefacts.push(await writeArtefact(params.runDir, postDiffPath, post.diffBinary.stdout));
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "post-changed-files.json"), json(postChanged)));
  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "post-untracked-files.json"), json(postUntrackedFiles)));

  const summary: WriteAuditResult = {
    phase: params.capture.phase,
    trackedDiffPatchArtefact: postDiffPath,
    note: "pre/post diff patch artefacts contain tracked git diff output only (git diff --binary); changedFiles also includes status-derived paths.",
    pre: {
      status: path.posix.join(relBase, "pre-status.txt"),
      diffStat: path.posix.join(relBase, "pre-diff-stat.txt"),
      diffPath: preDiffPath,
      changedFiles: preChanged,
      statusOnlyFiles: preStatusOnlyFiles,
      untrackedFiles: preUntrackedFiles
    },
    post: {
      status: path.posix.join(relBase, "post-status.txt"),
      diffStat: path.posix.join(relBase, "post-diff-stat.txt"),
      diffPath: postDiffPath,
      changedFiles: postChanged,
      statusOnlyFiles: postStatusOnlyFiles,
      untrackedFiles: postUntrackedFiles
    },
    changedFilesAddedByPhase,
    artefacts: []
  };

  artefacts.push(await writeArtefact(params.runDir, path.posix.join(relBase, "summary.json"), json(summary)));

  summary.artefacts = artefacts
    .map((p) => path.relative(params.runDir, p).replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));

  await writeArtefact(params.runDir, path.posix.join(relBase, "summary.json"), json(summary));
  return summary;
}

async function captureSnapshot(git: GitInspectionClient, workspaceRoot: string, label: string): Promise<WriteAuditSnapshot> {
  const status = await git.statusPorcelain(workspaceRoot);
  ensureSuccess(status, `${label}: git status --porcelain`);
  const diffNameOnly = await git.diffNameOnly(workspaceRoot);
  ensureSuccess(diffNameOnly, `${label}: git diff --name-only`);
  const diffStat = await git.diffStat(workspaceRoot);
  ensureSuccess(diffStat, `${label}: git diff --stat`);
  const diffBinary = await git.diffBinary(workspaceRoot);
  ensureSuccess(diffBinary, `${label}: git diff --binary`);
  return { status, diffNameOnly, diffStat, diffBinary };
}

function ensureSuccess(result: GitInspectionResult, label: string): void {
  if (result.success) return;
  throw new Error(`${label} failed (exit=${result.exitCode ?? "null"} signal=${result.signal ?? "null"}): ${result.stderr.trim()}`.trim());
}

function parseChangedFiles(output: string): string[] {
  return uniqueSorted(
    output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  );
}

function parseUntrackedPaths(status: string): string[] {
  const paths: string[] = [];
  for (const rawLine of status.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.startsWith("?? ")) {
      continue;
    }
    const payload = line.slice(3).trim();
    if (payload) {
      paths.push(payload);
    }
  }
  return uniqueSorted(paths);
}

function uniqueSorted(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b));
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeArtefact(runDir: string, relativePath: string, content: string): Promise<string> {
  const absolutePath = path.resolve(runDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  return absolutePath;
}
