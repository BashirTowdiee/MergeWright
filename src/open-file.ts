import { spawn } from "node:child_process";

export interface OpenFileResult {
  attempted: boolean;
  opened: boolean;
  skipped: boolean;
  reason?: string;
}

export async function openFileInBrowser(
  filePath: string,
  options?: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
    isTTY?: boolean;
    spawnFn?: typeof spawn;
  }
): Promise<OpenFileResult> {
  const platform = options?.platform ?? process.platform;
  const env = options?.env ?? process.env;
  const isTTY = options?.isTTY ?? Boolean(process.stdout.isTTY);
  if (env.CI === "true" || env.CI === "1" || !isTTY) {
    return { attempted: false, opened: false, skipped: true, reason: "CI/non-interactive environment" };
  }
  const command = commandForPlatform(platform, filePath);
  if (!command) {
    return { attempted: false, opened: false, skipped: true, reason: `unsupported platform: ${platform}` };
  }
  const spawnFn = options?.spawnFn ?? spawn;
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawnFn(command.command, command.args, { stdio: "ignore", detached: true });
      child.once("error", reject);
      child.once("spawn", () => resolve());
      child.unref();
    });
    return { attempted: true, opened: true, skipped: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { attempted: true, opened: false, skipped: false, reason: msg };
  }
}

function commandForPlatform(platform: NodeJS.Platform, filePath: string): { command: string; args: string[] } | null {
  if (platform === "darwin") return { command: "open", args: [filePath] };
  if (platform === "linux") return { command: "xdg-open", args: [filePath] };
  if (platform === "win32") return { command: "rundll32", args: ["url.dll,FileProtocolHandler", filePath] };
  return null;
}
