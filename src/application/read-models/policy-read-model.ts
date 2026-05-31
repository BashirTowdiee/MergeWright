export interface PolicySnapshot {
  requireGitRepo: boolean;
  requireCleanStart: boolean;
  manualCommitOnly: boolean;
  forbidAutoCommit: boolean;
  forbidAutoPush: boolean;
  writeSafetyEnabled: boolean;
  requireCleanWorkingTree: boolean;
  requireExplicitAllowWrites: boolean;
  requireReviewAfterWrites: boolean;
  allowedBranches: string[];
  blockedPaths: string[];
  checkCount: number;
}

export interface WriteSafetyStatusSnapshot {
  checkedAt: string;
  ok: boolean;
  summary: string;
  failures: string[];
  warnings: string[];
  enabled: boolean;
  branch: string;
  isGitWorkTree: boolean;
  workingTreeState: "clean" | "dirty" | "unknown";
  changedFilesCount: number;
  blockedMatchCount: number;
}
