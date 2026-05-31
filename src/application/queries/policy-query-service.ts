import type { OrchestratorConfig } from "../../config/types.js";
import { checkWriteSafety } from "../../write-safety.js";
import { createGitInspectionClient } from "../../git-inspection.js";
import type { PolicySnapshot, WriteSafetyStatusSnapshot } from "../read-models/policy-read-model.js";

export interface PolicyQueryService {
  getPolicySnapshot(): Promise<PolicySnapshot>;
  getWriteSafetyStatus(): Promise<WriteSafetyStatusSnapshot>;
}

export interface StaticPolicyQueryServiceOptions {
  config: OrchestratorConfig;
  workspaceRoot: string;
}

export class StaticPolicyQueryService implements PolicyQueryService {
  private readonly config: OrchestratorConfig;
  private readonly workspaceRoot: string;

  constructor(options: StaticPolicyQueryServiceOptions) {
    this.config = options.config;
    this.workspaceRoot = options.workspaceRoot;
  }

  async getPolicySnapshot(): Promise<PolicySnapshot> {
    return {
      requireGitRepo: this.config.safety.requireGitRepo,
      requireCleanStart: this.config.safety.requireCleanStart,
      manualCommitOnly: this.config.safety.manualCommit,
      forbidAutoCommit: this.config.safety.forbidAutoCommit,
      forbidAutoPush: this.config.safety.forbidAutoPush,
      writeSafetyEnabled: this.config.writeSafety.enabled,
      requireCleanWorkingTree: this.config.writeSafety.requireCleanWorkingTree,
      requireExplicitAllowWrites: this.config.writeSafety.requireExplicitAllowWrites,
      requireReviewAfterWrites: this.config.writeSafety.requireReviewAfterWrites,
      allowedBranches: [...this.config.writeSafety.allowedBranches],
      blockedPaths: [...this.config.writeSafety.blockedPaths],
      checkCount: this.config.commands.checks.length
    };
  }

  async getWriteSafetyStatus(): Promise<WriteSafetyStatusSnapshot> {
    const result = await checkWriteSafety({
      workspaceRoot: this.workspaceRoot,
      config: this.config,
      git: createGitInspectionClient()
    });
    return {
      checkedAt: new Date().toISOString(),
      ok: result.ok,
      summary: result.summary,
      failures: [...result.failures],
      warnings: [...result.warnings],
      enabled: result.enabled,
      branch: result.branch,
      isGitWorkTree: result.isGitWorkTree,
      workingTreeState: result.workingTreeState,
      changedFilesCount: result.changedFiles.length,
      blockedMatchCount: result.matchedBlockedPaths.length
    };
  }
}
