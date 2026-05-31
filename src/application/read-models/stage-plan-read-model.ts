import type { StagePlanSource, StagePlanStatus, StageStatus } from "../../stage-plan.js";

export interface StagePlanSummary {
  id: string;
  planId: string;
  title: string;
  goal: string;
  source: StagePlanSource;
  status: StagePlanStatus;
  updatedAt: string;
  stageCount: number;
  path: string;
}

export interface StagePlanStageSummary {
  id: string;
  index: number;
  title: string;
  status: StageStatus;
  dependsOn: string[];
  revision: number;
  commitSha?: string;
  acceptanceCriteriaCount: number;
  checksCount: number;
}

export interface StagePlanStatusCounts {
  pending: number;
  running: number;
  reviewRequired: number;
  accepted: number;
  fixRequired: number;
  failed: number;
  committed: number;
}

export interface StagePlanDetail {
  id: string;
  planId: string;
  title: string;
  goal: string;
  source: StagePlanSource;
  status: StagePlanStatus;
  createdAt: string;
  updatedAt: string;
  path: string;
  stageCount: number;
  statusCounts: StagePlanStatusCounts;
  stages: StagePlanStageSummary[];
}
