import type { AppCommand } from "../application/commands/app-command.js";
import type { AppCommandExecutionOptions } from "../application/commands/app-command-service.js";
import type { AppCommandResult } from "../application/commands/app-command-result.js";
import type { CommandDescription } from "../application/commands/command-description.js";
import type { PolicySnapshot, WriteSafetyStatusSnapshot } from "../application/read-models/policy-read-model.js";
import type { ProjectDetail, ProjectHealth, ProjectSummary } from "../application/read-models/project-read-model.js";
import type { ProviderInventory } from "../application/read-models/provider-read-model.js";
import type { ReviewDecision, ReviewItemView } from "../application/read-models/review-read-model.js";
import type { RunComparisonView } from "../application/read-models/run-comparison-read-model.js";
import type { RunEvidenceView, RunReadinessView, RunReviewView } from "../application/read-models/run-insights-read-model.js";
import type { RunPhaseArtifactsView } from "../application/read-models/run-phase-artifacts-read-model.js";
import type { RunArtefact, RunArtefactContent, RunDetail, RunSummary } from "../application/read-models/run-read-model.js";
import type { SettingsSnapshot, SettingsUpdate } from "../application/read-models/settings-read-model.js";
import type { StagePlanDetail, StagePlanSummary } from "../application/read-models/stage-plan-read-model.js";
import {
  getCommandEventsResponseSchema,
  getPolicyResponseSchema,
  getProvidersResponseSchema,
  listReviewsResponseSchema,
  addReviewCommentResponseSchema,
  decideReviewResponseSchema,
  getRunComparisonResponseSchema,
  getRunEventsResponseSchema,
  getProjectHealthResponseSchema,
  getProjectResponseSchema,
  getSettingsResponseSchema,
  getStagePlanResponseSchema,
  getRunArtifactContentResponseSchema,
  getRunArtifactResponseSchema,
  getRunEvidenceResponseSchema,
  getRunPhaseArtifactsResponseSchema,
  getRunReadinessResponseSchema,
  getRunResponseSchema,
  getRunReviewResponseSchema,
  getWriteSafetyStatusResponseSchema,
  listProjectsResponseSchema,
  listStagePlansResponseSchema,
  listRunArtifactsResponseSchema,
  listRunsResponseSchema,
  previewCommandResponseSchema,
  submitCommandResponseSchema,
  updateSettingsResponseSchema
} from "../api/run-api-schemas.js";

export interface WebApiResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type WebApiFetch = (url: string, init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string }) => Promise<WebApiResponse>;

export class WebApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown
  ) {
    super(message);
    this.name = "WebApiError";
  }
}

export interface ApiCommandEvent {
  readonly timestamp: string;
  readonly requestId?: string;
  readonly command: string;
  readonly status: "started" | "completed" | "failed";
  readonly exitCode?: number;
  readonly ok?: boolean;
  readonly error?: string;
  readonly runId?: string;
  readonly relatedRunIds?: readonly string[];
  readonly stageId?: string;
  readonly stagePlanArg?: string;
}

export interface WebApiClientOptions {
  readonly baseUrl: string;
  readonly fetch: WebApiFetch;
}

export class MergeWrightApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: WebApiFetch;

  constructor(options: WebApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetcher = options.fetch;
  }

  async listRuns(status?: RunSummary["status"] | "all"): Promise<readonly RunSummary[]> {
    const search = status === undefined ? "" : `?status=${encodeURIComponent(status)}`;
    const payload = await this.request(`/runs${search}`);
    return listRunsResponseSchema.parse(payload).runs;
  }

  async listProjects(): Promise<readonly ProjectSummary[]> {
    const payload = await this.request("/projects");
    return listProjectsResponseSchema.parse(payload).projects;
  }

  async getProject(projectId: string): Promise<ProjectDetail> {
    const payload = await this.request(`/projects/${encodeURIComponent(projectId)}`);
    return getProjectResponseSchema.parse(payload).project;
  }

  async getProjectHealth(projectId: string): Promise<ProjectHealth> {
    const payload = await this.request(`/projects/${encodeURIComponent(projectId)}/health`);
    return getProjectHealthResponseSchema.parse(payload).health;
  }

  async getProviderInventory(): Promise<ProviderInventory> {
    const payload = await this.request("/providers");
    return getProvidersResponseSchema.parse(payload).inventory;
  }

  async getPolicy(): Promise<PolicySnapshot> {
    const payload = await this.request("/policy");
    return getPolicyResponseSchema.parse(payload).policy;
  }

  async getWriteSafetyStatus(): Promise<WriteSafetyStatusSnapshot> {
    const payload = await this.request("/safety/write-status");
    return getWriteSafetyStatusResponseSchema.parse(payload).status;
  }

  async getSettings(): Promise<SettingsSnapshot> {
    const payload = await this.request("/settings");
    return getSettingsResponseSchema.parse(payload).settings;
  }

  async updateSettings(settings: SettingsUpdate): Promise<SettingsSnapshot> {
    const payload = await this.request("/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings })
    });
    return updateSettingsResponseSchema.parse(payload).settings;
  }

  async listReviews(): Promise<readonly ReviewItemView[]> {
    const payload = await this.request("/reviews");
    return listReviewsResponseSchema.parse(payload).reviews;
  }

  async addReviewComment(reviewId: string, message: string, author?: string): Promise<ReviewItemView> {
    const payload = await this.request(`/reviews/${encodeURIComponent(reviewId)}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, author })
    });
    return addReviewCommentResponseSchema.parse(payload).review;
  }

  async decideReview(reviewId: string, decision: ReviewDecision, note?: string, author?: string): Promise<ReviewItemView> {
    const payload = await this.request(`/reviews/${encodeURIComponent(reviewId)}/approval`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note, author })
    });
    return decideReviewResponseSchema.parse(payload).review;
  }

  async getRun(runId: string): Promise<RunDetail> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}`);
    return getRunResponseSchema.parse(payload).run;
  }

  async getRunReadiness(runId: string): Promise<RunReadinessView> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/readiness`);
    return getRunReadinessResponseSchema.parse(payload).readiness;
  }

  async getRunReview(runId: string): Promise<RunReviewView> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/review`);
    return getRunReviewResponseSchema.parse(payload).review;
  }

  async getRunEvidence(runId: string): Promise<RunEvidenceView> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/evidence`);
    return getRunEvidenceResponseSchema.parse(payload).evidence;
  }

  async getRunComparison(runIdA: string, runIdB: string): Promise<RunComparisonView> {
    const payload = await this.request(
      `/runs/compare?runA=${encodeURIComponent(runIdA)}&runB=${encodeURIComponent(runIdB)}`
    );
    return getRunComparisonResponseSchema.parse(payload).comparison;
  }

  async getRunPhaseArtifacts(runId: string): Promise<RunPhaseArtifactsView> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/phase-artifacts`);
    return getRunPhaseArtifactsResponseSchema.parse(payload).phaseArtifacts;
  }

  async listRunArtifacts(runId: string, phaseId?: string): Promise<readonly RunArtefact[]> {
    const query = phaseId === undefined ? "" : `?phaseId=${encodeURIComponent(phaseId)}`;
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/artifacts${query}`);
    return listRunArtifactsResponseSchema.parse(payload).artifacts;
  }

  async getRunArtifact(runId: string, artifactId: string): Promise<RunArtefact> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`);
    return getRunArtifactResponseSchema.parse(payload).artifact;
  }

  async getRunArtifactContent(runId: string, artifactId: string, maxBytes?: number): Promise<RunArtefactContent> {
    const query = maxBytes === undefined ? "" : `?maxBytes=${encodeURIComponent(String(maxBytes))}`;
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}/content${query}`);
    return getRunArtifactContentResponseSchema.parse(payload);
  }

  async listStagePlans(): Promise<readonly StagePlanSummary[]> {
    const payload = await this.request("/stage-plans");
    return listStagePlansResponseSchema.parse(payload).stagePlans;
  }

  async getStagePlan(stagePlanId: string): Promise<StagePlanDetail> {
    const payload = await this.request(`/stage-plans/${encodeURIComponent(stagePlanId)}`);
    return getStagePlanResponseSchema.parse(payload).stagePlan;
  }

  async submitCommand(command: AppCommand, options?: AppCommandExecutionOptions): Promise<AppCommandResult> {
    const payload = await this.request("/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, options })
    });
    return submitCommandResponseSchema.parse(payload).result;
  }

  async previewCommand(command: AppCommand, options?: AppCommandExecutionOptions): Promise<CommandDescription> {
    const payload = await this.request("/commands/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, options })
    });
    return previewCommandResponseSchema.parse(payload).description;
  }

  async getRunEvents(runId: string, limit = 100): Promise<readonly ApiCommandEvent[]> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/events?limit=${encodeURIComponent(String(limit))}`);
    return getRunEventsResponseSchema.parse(payload).events;
  }

  async getCommandEvents(commandId: string, limit = 100): Promise<readonly ApiCommandEvent[]> {
    const payload = await this.request(`/commands/${encodeURIComponent(commandId)}/events?limit=${encodeURIComponent(String(limit))}`);
    return getCommandEventsResponseSchema.parse(payload).events;
  }

  private async request(path: string, init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly body?: string }): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, init);
    const payload = await response.json();

    if (!response.ok) {
      throw new WebApiError(`MergeWright API request failed with status ${response.status}.`, response.status, payload);
    }

    return payload;
  }
}
