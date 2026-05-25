import type { AppCommand } from "../application/commands/app-command.js";
import type { AppCommandExecutionOptions } from "../application/commands/app-command-service.js";
import type { AppCommandResult } from "../application/commands/app-command-result.js";
import type { RunArtefact, RunDetail, RunSummary } from "../application/read-models/run-read-model.js";
import {
  getRunArtifactResponseSchema,
  getRunResponseSchema,
  listRunArtifactsResponseSchema,
  listRunsResponseSchema,
  submitCommandResponseSchema
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

  async getRun(runId: string): Promise<RunDetail> {
    const payload = await this.request(`/runs/${encodeURIComponent(runId)}`);
    return getRunResponseSchema.parse(payload).run;
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

  async submitCommand(command: AppCommand, options?: AppCommandExecutionOptions): Promise<AppCommandResult> {
    const payload = await this.request("/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, options })
    });
    return submitCommandResponseSchema.parse(payload).result;
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
