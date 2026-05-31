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
  createProjectResponseSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  updateProjectResponseSchema,
  updateProjectConfigRequestSchema,
  updateProjectConfigResponseSchema,
  deleteProjectResponseSchema,
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

  async listRuns(status?: RunSummary["status"] | "all", projectId?: string): Promise<readonly RunSummary[]> {
    const query = new URLSearchParams();
    if (status !== undefined) {
      query.set("status", status);
    }
    if (projectId) {
      query.set("projectId", projectId);
    }
    const search = query.size > 0 ? `?${query.toString()}` : "";
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

  async createProject(input: { name: string; configPath: string }): Promise<ProjectDetail> {
    const request = createProjectRequestSchema.parse({ project: input });
    const payload = await this.request("/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
    return createProjectResponseSchema.parse(payload).project;
  }

  async updateProject(projectId: string, input: { name?: string; configPath?: string }): Promise<ProjectDetail> {
    const request = updateProjectRequestSchema.parse({ project: input });
    const payload = await this.request(`/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
    return updateProjectResponseSchema.parse(payload).project;
  }

  async updateProjectConfig(projectId: string, input: { runsDir?: string; defaultProvider?: string; defaultModel?: string }): Promise<ProjectDetail> {
    const request = updateProjectConfigRequestSchema.parse({ config: input });
    const payload = await this.request(`/projects/${encodeURIComponent(projectId)}/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
    return updateProjectConfigResponseSchema.parse(payload).project;
  }

  async deleteProject(projectId: string): Promise<void> {
    const payload = await this.request(`/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE"
    });
    deleteProjectResponseSchema.parse(payload);
  }

  async getProviderInventory(projectId?: string): Promise<ProviderInventory> {
    const payload = await this.request(withProjectQuery("/providers", projectId));
    return getProvidersResponseSchema.parse(payload).inventory;
  }

  async getPolicy(projectId?: string): Promise<PolicySnapshot> {
    const payload = await this.request(withProjectQuery("/policy", projectId));
    return getPolicyResponseSchema.parse(payload).policy;
  }

  async getWriteSafetyStatus(projectId?: string): Promise<WriteSafetyStatusSnapshot> {
    const payload = await this.request(withProjectQuery("/safety/write-status", projectId));
    return getWriteSafetyStatusResponseSchema.parse(payload).status;
  }

  async getSettings(projectId?: string): Promise<SettingsSnapshot> {
    const payload = await this.request(withProjectQuery("/settings", projectId));
    return getSettingsResponseSchema.parse(payload).settings;
  }

  async updateSettings(settings: SettingsUpdate, projectId?: string): Promise<SettingsSnapshot> {
    const payload = await this.request(withProjectQuery("/settings", projectId), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings })
    });
    return updateSettingsResponseSchema.parse(payload).settings;
  }

  async listReviews(projectId?: string): Promise<readonly ReviewItemView[]> {
    const payload = await this.request(withProjectQuery("/reviews", projectId));
    return listReviewsResponseSchema.parse(payload).reviews;
  }

  async addReviewComment(reviewId: string, message: string, author?: string, projectId?: string): Promise<ReviewItemView> {
    const payload = await this.request(withProjectQuery(`/reviews/${encodeURIComponent(reviewId)}/comments`, projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, author })
    });
    return addReviewCommentResponseSchema.parse(payload).review;
  }

  async decideReview(reviewId: string, decision: ReviewDecision, note?: string, author?: string, projectId?: string): Promise<ReviewItemView> {
    const payload = await this.request(withProjectQuery(`/reviews/${encodeURIComponent(reviewId)}/approval`, projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note, author })
    });
    return decideReviewResponseSchema.parse(payload).review;
  }

  async getRun(runId: string, projectId?: string): Promise<RunDetail> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}`, projectId));
    return getRunResponseSchema.parse(payload).run;
  }

  async getRunReadiness(runId: string, projectId?: string): Promise<RunReadinessView> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}/readiness`, projectId));
    return getRunReadinessResponseSchema.parse(payload).readiness;
  }

  async getRunReview(runId: string, projectId?: string): Promise<RunReviewView> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}/review`, projectId));
    return getRunReviewResponseSchema.parse(payload).review;
  }

  async getRunEvidence(runId: string, projectId?: string): Promise<RunEvidenceView> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}/evidence`, projectId));
    return getRunEvidenceResponseSchema.parse(payload).evidence;
  }

  async getRunComparison(runIdA: string, runIdB: string, projectId?: string): Promise<RunComparisonView> {
    const query = new URLSearchParams({
      runA: runIdA,
      runB: runIdB
    });
    if (projectId) {
      query.set("projectId", projectId);
    }
    const payload = await this.request(`/runs/compare?${query.toString()}`);
    return getRunComparisonResponseSchema.parse(payload).comparison;
  }

  async getRunPhaseArtifacts(runId: string, projectId?: string): Promise<RunPhaseArtifactsView> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}/phase-artifacts`, projectId));
    return getRunPhaseArtifactsResponseSchema.parse(payload).phaseArtifacts;
  }

  async listRunArtifacts(runId: string, phaseId?: string, projectId?: string): Promise<readonly RunArtefact[]> {
    const query = new URLSearchParams();
    if (phaseId) {
      query.set("phaseId", phaseId);
    }
    if (projectId) {
      query.set("projectId", projectId);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/artifacts${suffix}`);
    return listRunArtifactsResponseSchema.parse(payload).artifacts;
  }

  async getRunArtifact(runId: string, artifactId: string, projectId?: string): Promise<RunArtefact> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`, projectId));
    return getRunArtifactResponseSchema.parse(payload).artifact;
  }

  async getRunArtifactContent(runId: string, artifactId: string, maxBytes?: number, projectId?: string): Promise<RunArtefactContent> {
    const query = new URLSearchParams();
    if (maxBytes !== undefined) {
      query.set("maxBytes", String(maxBytes));
    }
    if (projectId) {
      query.set("projectId", projectId);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}/content${suffix}`);
    return getRunArtifactContentResponseSchema.parse(payload);
  }

  async listStagePlans(projectId?: string): Promise<readonly StagePlanSummary[]> {
    const payload = await this.request(withProjectQuery("/stage-plans", projectId));
    return listStagePlansResponseSchema.parse(payload).stagePlans;
  }

  async getStagePlan(stagePlanId: string, projectId?: string): Promise<StagePlanDetail> {
    const payload = await this.request(withProjectQuery(`/stage-plans/${encodeURIComponent(stagePlanId)}`, projectId));
    return getStagePlanResponseSchema.parse(payload).stagePlan;
  }

  async submitCommand(command: AppCommand, options?: AppCommandExecutionOptions, projectId?: string): Promise<AppCommandResult> {
    const payload = await this.request(withProjectQuery("/commands", projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, options })
    });
    return submitCommandResponseSchema.parse(payload).result;
  }

  async previewCommand(command: AppCommand, options?: AppCommandExecutionOptions, projectId?: string): Promise<CommandDescription> {
    const payload = await this.request(withProjectQuery("/commands/preview", projectId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, options })
    });
    return previewCommandResponseSchema.parse(payload).description;
  }

  async getRunEvents(runId: string, limit = 100, projectId?: string): Promise<readonly ApiCommandEvent[]> {
    const payload = await this.request(withProjectQuery(`/runs/${encodeURIComponent(runId)}/events?limit=${encodeURIComponent(String(limit))}`, projectId));
    return getRunEventsResponseSchema.parse(payload).events;
  }

  async getCommandEvents(commandId: string, limit = 100, projectId?: string): Promise<readonly ApiCommandEvent[]> {
    const payload = await this.request(withProjectQuery(`/commands/${encodeURIComponent(commandId)}/events?limit=${encodeURIComponent(String(limit))}`, projectId));
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

function withProjectQuery(route: string, projectId?: string): string {
  if (!projectId) {
    return route;
  }
  const joiner = route.includes("?") ? "&" : "?";
  return `${route}${joiner}projectId=${encodeURIComponent(projectId)}`;
}
