export const STAGE_PLAN_SCHEMA_VERSION = 1 as const;

export const STAGE_PLAN_STATUSES = ["draft", "ready", "running", "paused", "completed", "failed"] as const;
export type StagePlanStatus = (typeof STAGE_PLAN_STATUSES)[number];

export const STAGE_STATUSES = [
  "pending",
  "running",
  "review_required",
  "accepted",
  "fix_required",
  "fixing",
  "passed",
  "failed",
  "committed",
  "needs_revision",
  "invalidated",
  "skipped"
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export type StagePlanSource = "generated" | "imported" | "manual";

export interface StageScope {
  include: string[];
  exclude: string[];
}

export interface Stage {
  id: string;
  index: number;
  title: string;
  goal: string;
  status: StageStatus;
  dependsOn: string[];
  assumptions: string[];
  scope: StageScope;
  acceptanceCriteria: string[];
  checks: string[];
  expectedOutputs: string[];
  revision: number;
  commitSha?: string;
}

export interface StagePlan {
  schemaVersion: typeof STAGE_PLAN_SCHEMA_VERSION;
  id: string;
  title: string;
  goal: string;
  source: StagePlanSource;
  status: StagePlanStatus;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
}
