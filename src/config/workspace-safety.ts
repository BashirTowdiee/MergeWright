import { access } from "node:fs/promises";
import path from "node:path";

export async function validateWorkspaceSafety(workspaceRoot: string, requireGitRepo: boolean): Promise<void> {
  try {
    await access(workspaceRoot);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Target workspaceRoot does not exist or is not accessible: ${workspaceRoot}. ${msg}`);
  }

  if (requireGitRepo) {
    const gitDir = path.resolve(workspaceRoot, ".git");
    try {
      await access(gitDir);
    } catch {
      throw new Error(`Target workspaceRoot is not a git repository: missing ${gitDir}`);
    }
  }
}
