import { spawn } from "node:child_process";
import path from "node:path";
import type { ConfiguredCheckCommand } from "./config.js";

export interface ExecutableCheckCommand {
  name: string;
  command: string;
  args: string[];
  cwd: string;
}

export interface CheckExecutionResult {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  success: boolean;
}

type SpawnLike = typeof spawn;

const DENIED_EXECUTABLES = new Set([
  "sh",
  "bash",
  "zsh",
  "fish",
  "pwsh",
  "powershell",
  "cmd",
  "cmd.exe",
  "sudo",
  "su"
]);

const DENIED_GIT_SUBCOMMANDS = new Set([
  "add",
  "am",
  "apply",
  "branch",
  "checkout",
  "cherry-pick",
  "clean",
  "commit",
  "merge",
  "mv",
  "pull",
  "push",
  "rebase",
  "reset",
  "restore",
  "revert",
  "rm",
  "stash",
  "switch",
  "tag"
]);

const GIT_GLOBAL_OPTIONS_REQUIRING_VALUE = new Set([
  "-C",
  "--git-dir",
  "--work-tree",
  "-c",
  "--config-env",
  "--namespace"
]);

const GIT_GLOBAL_OPTIONS_WITHOUT_VALUE = new Set([
  "--no-pager",
  "--paginate",
  "--literal-pathspecs",
  "--glob-pathspecs",
  "--noglob-pathspecs",
  "--icase-pathspecs"
]);

function normalizeExecutable(command: string): string {
  const normalizedPath = command.replaceAll("\\", "/");
  return path.posix.basename(normalizedPath).toLowerCase();
}

function hasRecursiveFlag(arg: string): boolean {
  return arg === "-R" || arg === "--recursive" || /^-[^-]*R/.test(arg);
}

function hasRmDangerousFlag(arg: string): boolean {
  return arg === "--recursive" || arg === "--force" || /^-[^-]*[rRf]/.test(arg);
}

function resolveGitSubcommand(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token) continue;
    if (token === "--") return undefined;
    if (GIT_GLOBAL_OPTIONS_REQUIRING_VALUE.has(token)) {
      i += 1;
      continue;
    }
    if (GIT_GLOBAL_OPTIONS_WITHOUT_VALUE.has(token)) {
      continue;
    }
    if (token.startsWith("-")) {
      continue;
    }
    return token;
  }
  return undefined;
}

export function validateConfiguredCheckCommand(command: ConfiguredCheckCommand): void {
  if (!command.command.trim()) {
    throw new Error(`Invalid check command "${command.name}": command must be non-empty`);
  }
  if (command.command.includes(" ")) {
    throw new Error(`Invalid check command "${command.name}": command must not contain spaces`);
  }
  if (command.args.some((arg) => typeof arg !== "string")) {
    throw new Error(`Invalid check command "${command.name}": args must be a string array`);
  }

  const executable = normalizeExecutable(command.command);

  if (DENIED_EXECUTABLES.has(executable)) {
    throw new Error(`Invalid check command "${command.name}": command "${command.command}" is denied`);
  }

  if (executable === "env") {
    throw new Error(`Invalid check command "${command.name}": command "${command.command}" is denied`);
  }

  if (executable === "git") {
    const subcommand = resolveGitSubcommand(command.args);
    if (subcommand && DENIED_GIT_SUBCOMMANDS.has(subcommand)) {
      throw new Error(`Invalid check command "${command.name}": denied git subcommand "${subcommand}"`);
    }
  }

  if (executable === "rm" && command.args.some((arg) => hasRmDangerousFlag(arg))) {
    throw new Error(`Invalid check command "${command.name}": command "rm" has dangerous recursive/force flags`);
  }

  if (executable === "chmod" && command.args.some((arg) => hasRecursiveFlag(arg))) {
    throw new Error(`Invalid check command "${command.name}": command "chmod" has denied recursive flag`);
  }

  if (executable === "chown" && command.args.some((arg) => hasRecursiveFlag(arg))) {
    throw new Error(`Invalid check command "${command.name}": command "chown" has denied recursive flag`);
  }
}

export function resolveCheckCommandCwd(
  command: ConfiguredCheckCommand,
  orchestratorRoot: string,
  workspaceRoot: string
): string {
  return command.cwd === "workspace" ? path.resolve(workspaceRoot) : path.resolve(orchestratorRoot);
}

export async function executeCheckCommand(
  command: ExecutableCheckCommand,
  spawnImpl: SpawnLike = spawn
): Promise<CheckExecutionResult> {
  const startedAt = Date.now();
  return await new Promise<CheckExecutionResult>((resolve, reject) => {
    const child = spawnImpl(command.command, command.args, {
      cwd: command.cwd,
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
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      const durationMs = Date.now() - startedAt;
      resolve({
        name: command.name,
        command: command.command,
        args: [...command.args],
        cwd: command.cwd,
        stdout,
        stderr,
        exitCode,
        signal,
        durationMs,
        success: exitCode === 0 && signal === null
      });
    });
  });
}
