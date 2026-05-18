import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildOpenCodeReadOnlyCommand, type OpenCodeBuiltCommand, type OpenCodeExecutionRequest } from "./opencode-cli-backend.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 5_000;

export interface OpenCodeCliContract {
  command: string;
  versionCommand: string[];
  helpCommand: string[];
  runHelpCommand: string[];
  supportsRunSubcommand: boolean;
  supportsModelFlag: boolean;
  supportsCwdFlag: boolean;
  supportsOutputFlag: boolean;
  supportsStdinPrompt: boolean;
  verifiedAt: string;
}

export interface OpenCodeCliContractProbeResult {
  ok: boolean;
  contract: OpenCodeCliContract;
  stdout: string;
  stderr: string;
  errors: string[];
}

export interface ProbeOpenCodeCliContractOptions {
  command?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface OpenCodeReadOnlyCommandContractValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

interface ProbeCommandResult {
  label: string;
  args: string[];
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export async function probeOpenCodeCliContract(
  options: ProbeOpenCodeCliContractOptions = {}
): Promise<OpenCodeCliContractProbeResult> {
  const command = validateOpenCodeProbeCommand(options.command ?? "opencode");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const versionCommand = ["--version"];
  const helpCommand = ["--help"];
  const runHelpCommand = ["run", "--help"];

  const [versionResult, helpResult, runHelpResult] = await Promise.all([
    runProbeCommand(command, versionCommand, "version", timeoutMs, options.env),
    runProbeCommand(command, helpCommand, "help", timeoutMs, options.env),
    runProbeCommand(command, runHelpCommand, "run-help", timeoutMs, options.env)
  ]);

  const combinedStdout = [versionResult.stdout, helpResult.stdout, runHelpResult.stdout].filter(Boolean).join("\n");
  const combinedStderr = [versionResult.stderr, helpResult.stderr, runHelpResult.stderr].filter(Boolean).join("\n");
  const combinedHelp = `${helpResult.stdout}\n${helpResult.stderr}\n${runHelpResult.stdout}\n${runHelpResult.stderr}`.toLowerCase();
  const rootHelp = `${helpResult.stdout}\n${helpResult.stderr}`.toLowerCase();
  const runHelp = `${runHelpResult.stdout}\n${runHelpResult.stderr}`.toLowerCase();

  const supportsRunSubcommand = runHelpResult.ok || /(^|\s)run(\s|,|$)/i.test(rootHelp);
  const supportsModelFlag = includesAny(combinedHelp, ["--model", "-m,", "-m "]);
  const supportsCwdFlag = includesAny(combinedHelp, ["--cwd", "--chdir", "--directory", "--workdir"]);
  const supportsOutputFlag = includesAny(combinedHelp, ["--output", "--out", "-o,", "-o "]);
  const supportsStdinPrompt = includesAny(runHelp, ["stdin", "standard input", "- ", "--stdin"]);

  const errors = [versionResult, helpResult, runHelpResult]
    .filter((result) => !result.ok)
    .map((result) => result.error ?? `${result.label} command failed`);

  if (!supportsRunSubcommand) {
    errors.push('OpenCode help did not confirm a "run" subcommand.');
  }
  if (!supportsModelFlag) {
    errors.push('OpenCode help did not confirm a model flag such as "--model".');
  }
  if (!supportsCwdFlag) {
    errors.push('OpenCode help did not confirm a workspace flag such as "--cwd".');
  }
  if (!supportsOutputFlag) {
    errors.push('OpenCode help did not confirm an output flag such as "--output".');
  }
  if (!supportsStdinPrompt) {
    errors.push("OpenCode run help did not clearly document stdin prompt support.");
  }

  const contract: OpenCodeCliContract = {
    command,
    versionCommand,
    helpCommand,
    runHelpCommand,
    supportsRunSubcommand,
    supportsModelFlag,
    supportsCwdFlag,
    supportsOutputFlag,
    supportsStdinPrompt,
    verifiedAt: new Date().toISOString()
  };

  return {
    ok: errors.length === 0,
    contract,
    stdout: combinedStdout,
    stderr: combinedStderr,
    errors
  };
}

export function validateOpenCodeProbeCommand(command: string): string {
  if (typeof command !== "string" || command.trim().length === 0) {
    throw new Error("Invalid OpenCode CLI command: command must be non-empty.");
  }
  if (command.includes(" ")) {
    throw new Error("Invalid OpenCode CLI command: command must be an executable name only.");
  }
  return command;
}

export function validateOpenCodeReadOnlyCommandAgainstContract(input: {
  contract: OpenCodeCliContract;
  builtCommand: OpenCodeBuiltCommand;
}): OpenCodeReadOnlyCommandContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { contract, builtCommand } = input;

  if (builtCommand.command !== contract.command) {
    errors.push(
      `OpenCode command mismatch: built command "${builtCommand.command}" does not match verified contract command "${contract.command}".`
    );
  }

  if (builtCommand.args[0] !== "run") {
    errors.push('OpenCode command args must start with "run" for read-only execution.');
  }

  if (!contract.supportsRunSubcommand) {
    errors.push('Verified OpenCode contract does not confirm support for the "run" subcommand.');
  }
  if (builtCommand.args.includes("--model") && !contract.supportsModelFlag) {
    errors.push('Verified OpenCode contract does not confirm support for "--model".');
  }
  if (builtCommand.args.includes("--cwd") && !contract.supportsCwdFlag) {
    errors.push('Verified OpenCode contract does not confirm support for "--cwd".');
  }
  if (builtCommand.args.includes("--output") && !contract.supportsOutputFlag) {
    errors.push('Verified OpenCode contract does not confirm support for "--output".');
  }
  if (builtCommand.args.includes("-") && !contract.supportsStdinPrompt) {
    errors.push('Verified OpenCode contract does not confirm support for stdin prompt marker "-".');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

export function buildAndValidateOpenCodeReadOnlyCommand(input: {
  request: OpenCodeExecutionRequest;
  contract: OpenCodeCliContract;
}): {
  command: OpenCodeBuiltCommand;
  validation: OpenCodeReadOnlyCommandContractValidationResult;
} {
  const command = buildOpenCodeReadOnlyCommand(input.request);
  const validation = validateOpenCodeReadOnlyCommandAgainstContract({
    contract: input.contract,
    builtCommand: command
  });
  return { command, validation };
}

async function runProbeCommand(
  command: string,
  args: string[],
  label: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv | undefined
): Promise<ProbeCommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      env: env ?? process.env
    });
    return {
      label,
      args,
      ok: true,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const executionError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      signal?: string;
      killed?: boolean;
    };
    const reason = executionError.message || String(error);
    return {
      label,
      args,
      ok: false,
      stdout: executionError.stdout ?? "",
      stderr: executionError.stderr ?? "",
      error: `OpenCode ${label} probe failed for command "${command} ${args.join(" ")}": ${reason}`
    };
  }
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
