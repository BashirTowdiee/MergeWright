export interface GitStatusSnapshot {
  summary: string;
}

export function getGitStatus(): never {
  throw new Error("Git command execution is not implemented in the current orchestrator stage.");
}
