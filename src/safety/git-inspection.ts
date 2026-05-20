import { spawn } from "node:child_process";

export type GitInspectionCommandName =
  | "isInsideWorkTree"
  | "currentBranch"
  | "statusPorcelain"
  | "diffNameOnly"
  | "diffStat"
  | "diffBinary";

export interface GitInspectionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  success: boolean;
}

export type GitInspectionExecutor = (command: string, args: string[], cwd: string) => Promise<GitInspectionResult>;
type SpawnLike = typeof spawn;

const COMMAND_MAP: Record<GitInspectionCommandName, string[]> = {
  isInsideWorkTree: ["rev-parse", "--is-inside-work-tree"],
  currentBranch: ["branch", "--show-current"],
  statusPorcelain: ["status", "--porcelain"],
  diffNameOnly: ["diff", "--name-only"],
  diffStat: ["diff", "--stat"],
  diffBinary: ["diff", "--binary"]
};

export function buildGitInspectionCommand(name: GitInspectionCommandName): { command: string; args: string[] } {
  return { command: "git", args: [...COMMAND_MAP[name]] };
}

export async function runGitInspection(
  name: GitInspectionCommandName,
  cwd: string,
  executor: GitInspectionExecutor = spawnGitInspectionCommand
): Promise<GitInspectionResult> {
  const { command, args } = buildGitInspectionCommand(name);
  return await executor(command, args, cwd);
}

export async function spawnGitInspectionCommand(
  command: string,
  args: string[],
  cwd: string,
  spawnImpl: SpawnLike = spawn
): Promise<GitInspectionResult> {
  return await new Promise<GitInspectionResult>((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      shell: false,
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolve({
        stdout,
        stderr,
        exitCode,
        signal,
        success: exitCode === 0 && signal === null
      });
    });
  });
}

export interface GitInspectionClient {
  isInsideWorkTree(cwd: string): Promise<GitInspectionResult>;
  currentBranch(cwd: string): Promise<GitInspectionResult>;
  statusPorcelain(cwd: string): Promise<GitInspectionResult>;
  diffNameOnly(cwd: string): Promise<GitInspectionResult>;
  diffStat(cwd: string): Promise<GitInspectionResult>;
  diffBinary(cwd: string): Promise<GitInspectionResult>;
}

export function createGitInspectionClient(executor: GitInspectionExecutor = spawnGitInspectionCommand): GitInspectionClient {
  return {
    isInsideWorkTree: async (cwd) => await runGitInspection("isInsideWorkTree", cwd, executor),
    currentBranch: async (cwd) => await runGitInspection("currentBranch", cwd, executor),
    statusPorcelain: async (cwd) => await runGitInspection("statusPorcelain", cwd, executor),
    diffNameOnly: async (cwd) => await runGitInspection("diffNameOnly", cwd, executor),
    diffStat: async (cwd) => await runGitInspection("diffStat", cwd, executor),
    diffBinary: async (cwd) => await runGitInspection("diffBinary", cwd, executor)
  };
}
