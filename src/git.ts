import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitWorktreeStatus {
  branch?: string;
  ahead?: number;
  behind?: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitClient {
  assertGitAvailable(cwd: string): Promise<void>;
  getWorktreeStatus(cwd: string): Promise<GitWorktreeStatus>;
  getChangedFiles(cwd: string): Promise<string[]>;
  hasDiff(cwd: string): Promise<boolean>;
  commitAll(cwd: string, message: string): Promise<string>;
  getHeadSha(cwd: string): Promise<string>;
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trimEnd();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(" ")} failed: ${message}`);
  }
}

export async function assertGitAvailable(cwd: string): Promise<void> {
  await runGit(cwd, ["--version"]);
}

export async function getWorktreeStatus(cwd: string): Promise<GitWorktreeStatus> {
  const raw = await runGit(cwd, ["status", "--porcelain=1", "--branch"]);
  const lines = raw.split("\n").map((line) => line.trimEnd()).filter((line) => line.length > 0);
  const branchLine = lines.find((line) => line.startsWith("## "));
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) continue;
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    const file = line.slice(3).trim();
    if (!file) continue;
    if (x === "?" && y === "?") {
      untracked.push(file);
      continue;
    }
    if (x !== " ") staged.push(file);
    if (y !== " ") unstaged.push(file);
  }

  let branch: string | undefined;
  let ahead: number | undefined;
  let behind: number | undefined;
  if (branchLine) {
    const payload = branchLine.slice(3);
    const [branchPart, trackingPart] = payload.split("...");
    branch = branchPart?.trim() || undefined;
    if (trackingPart && trackingPart.includes("[")) {
      const bracketStart = trackingPart.indexOf("[");
      const counts = trackingPart.slice(bracketStart + 1, trackingPart.lastIndexOf("]"));
      const matchAhead = counts.match(/ahead (\d+)/);
      const matchBehind = counts.match(/behind (\d+)/);
      ahead = matchAhead ? Number.parseInt(matchAhead[1] ?? "0", 10) : 0;
      behind = matchBehind ? Number.parseInt(matchBehind[1] ?? "0", 10) : 0;
    }
  }

  return { branch, ahead, behind, staged, unstaged, untracked };
}

export async function getChangedFiles(cwd: string): Promise<string[]> {
  const raw = await runGit(cwd, ["status", "--porcelain=1"]);
  const changed = raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3).trim())
    .filter((line) => line.length > 0);
  return [...new Set(changed)];
}

export async function hasDiff(cwd: string): Promise<boolean> {
  const files = await getChangedFiles(cwd);
  return files.length > 0;
}

export async function commitAll(cwd: string, message: string): Promise<string> {
  await runGit(cwd, ["add", "-A"]);
  await runGit(cwd, ["commit", "-m", message]);
  return await getHeadSha(cwd);
}

export async function getHeadSha(cwd: string): Promise<string> {
  return await runGit(cwd, ["rev-parse", "HEAD"]);
}

export function createGitClient(): GitClient {
  return {
    assertGitAvailable,
    getWorktreeStatus,
    getChangedFiles,
    hasDiff,
    commitAll,
    getHeadSha
  };
}
