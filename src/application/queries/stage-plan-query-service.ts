import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Stage, StagePlan, StageStatus } from "../../stage-plan.js";
import { readStagePlan } from "../../stage-plan-store.js";
import type { StagePlanDetail, StagePlanStageSummary, StagePlanStatusCounts, StagePlanSummary } from "../read-models/stage-plan-read-model.js";

export interface StagePlanQueryService {
  listStagePlans(): Promise<StagePlanSummary[]>;
  getStagePlan(stagePlanId: string): Promise<StagePlanDetail | null>;
}

export interface FilesystemStagePlanQueryServiceOptions {
  orchestratorRoot: string;
  candidateRoots?: string[];
}

interface StagePlanFile {
  id: string;
  relativePath: string;
  absolutePath: string;
}

export class FilesystemStagePlanQueryService implements StagePlanQueryService {
  private readonly orchestratorRoot: string;
  private readonly candidateRoots: string[];

  constructor(options: FilesystemStagePlanQueryServiceOptions) {
    this.orchestratorRoot = path.resolve(options.orchestratorRoot);
    this.candidateRoots = options.candidateRoots?.length ? [...options.candidateRoots] : [".artifacts", "stages", "runs"];
  }

  async listStagePlans(): Promise<StagePlanSummary[]> {
    const planFiles = await this.discoverStagePlanFiles();
    const summaries: StagePlanSummary[] = [];

    for (const file of planFiles) {
      try {
        const plan = await readStagePlan(file.absolutePath);
        summaries.push(toStagePlanSummary(file, plan));
      } catch {
        continue;
      }
    }

    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries;
  }

  async getStagePlan(stagePlanId: string): Promise<StagePlanDetail | null> {
    if (!stagePlanId.trim()) {
      return null;
    }

    const relativePath = decodeStagePlanId(stagePlanId);
    if (!relativePath) {
      return null;
    }

    const absolutePath = path.resolve(this.orchestratorRoot, relativePath);
    const relative = path.relative(this.orchestratorRoot, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return null;
    }

    try {
      const plan = await readStagePlan(absolutePath);
      const file: StagePlanFile = {
        id: stagePlanId,
        relativePath: normalizePosixPath(relative),
        absolutePath
      };
      return toStagePlanDetail(file, plan);
    } catch {
      return null;
    }
  }

  private async discoverStagePlanFiles(): Promise<StagePlanFile[]> {
    const files = new Map<string, StagePlanFile>();
    for (const root of this.candidateRoots) {
      const absoluteRoot = path.resolve(this.orchestratorRoot, root);
      const relativeRoot = path.relative(this.orchestratorRoot, absoluteRoot);
      if (relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
        continue;
      }

      for (const file of await walkStagePlanFiles(absoluteRoot, this.orchestratorRoot)) {
        files.set(file.relativePath, file);
      }
    }
    return [...files.values()];
  }
}

async function walkStagePlanFiles(root: string, orchestratorRoot: string): Promise<StagePlanFile[]> {
  const results: StagePlanFile[] = [];

  async function visit(current: string, depth: number): Promise<void> {
    if (depth > 10) {
      return;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(child, depth + 1);
        continue;
      }
      if (!entry.isFile() || entry.name !== "stage-plan.json") {
        continue;
      }

      const relativePath = normalizePosixPath(path.relative(orchestratorRoot, child));
      if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        continue;
      }
      results.push({
        id: encodeStagePlanId(relativePath),
        relativePath,
        absolutePath: child
      });
    }
  }

  await visit(root, 0);
  return results;
}

function toStagePlanSummary(file: StagePlanFile, plan: StagePlan): StagePlanSummary {
  return {
    id: file.id,
    planId: plan.id,
    title: plan.title,
    goal: plan.goal,
    source: plan.source,
    status: plan.status,
    updatedAt: plan.updatedAt,
    stageCount: plan.stages.length,
    path: file.relativePath
  };
}

function toStagePlanDetail(file: StagePlanFile, plan: StagePlan): StagePlanDetail {
  return {
    id: file.id,
    planId: plan.id,
    title: plan.title,
    goal: plan.goal,
    source: plan.source,
    status: plan.status,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    path: file.relativePath,
    stageCount: plan.stages.length,
    statusCounts: countStageStatuses(plan.stages),
    stages: plan.stages.map(toStageSummary)
  };
}

function toStageSummary(stage: Stage): StagePlanStageSummary {
  return {
    id: stage.id,
    index: stage.index,
    title: stage.title,
    status: stage.status,
    dependsOn: [...stage.dependsOn],
    revision: stage.revision,
    commitSha: stage.commitSha,
    acceptanceCriteriaCount: stage.acceptanceCriteria.length,
    checksCount: stage.checks.length
  };
}

function countStageStatuses(stages: Stage[]): StagePlanStatusCounts {
  const counts: StagePlanStatusCounts = {
    pending: 0,
    running: 0,
    reviewRequired: 0,
    accepted: 0,
    fixRequired: 0,
    failed: 0,
    committed: 0
  };

  for (const stage of stages) {
    incrementCount(counts, stage.status);
  }
  return counts;
}

function incrementCount(counts: StagePlanStatusCounts, status: StageStatus): void {
  if (status === "pending") counts.pending += 1;
  if (status === "running") counts.running += 1;
  if (status === "review_required") counts.reviewRequired += 1;
  if (status === "accepted") counts.accepted += 1;
  if (status === "fix_required") counts.fixRequired += 1;
  if (status === "failed") counts.failed += 1;
  if (status === "committed") counts.committed += 1;
}

function encodeStagePlanId(relativePath: string): string {
  return Buffer.from(relativePath, "utf8").toString("base64url");
}

function decodeStagePlanId(stagePlanId: string): string | null {
  try {
    const decoded = Buffer.from(stagePlanId, "base64url").toString("utf8");
    if (!decoded.trim()) {
      return null;
    }
    return normalizePosixPath(decoded);
  } catch {
    return null;
  }
}

function normalizePosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
