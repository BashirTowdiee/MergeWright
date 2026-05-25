import type { RunDetail, RunStatus, RunSummary } from "../read-models/run-read-model.js";

export interface ListRunsInput {
  status?: RunStatus | "all";
}

export interface GetRunInput {
  runId: string;
}

export interface RunReadRepository {
  listRuns(): Promise<RunSummary[]>;
  getRun(runId: string): Promise<RunDetail | null>;
}

export interface RunQueryService {
  listRuns(input?: ListRunsInput): Promise<RunSummary[]>;
  getRun(input: GetRunInput): Promise<RunDetail | null>;
}

export class DefaultRunQueryService implements RunQueryService {
  constructor(private readonly repository: RunReadRepository) {}

  async listRuns(input: ListRunsInput = {}): Promise<RunSummary[]> {
    const runs = await this.repository.listRuns();
    const status = input.status ?? "all";
    if (status === "all") {
      return runs;
    }
    return runs.filter((run) => run.status === status);
  }

  async getRun(input: GetRunInput): Promise<RunDetail | null> {
    if (!input.runId.trim()) {
      return null;
    }
    return this.repository.getRun(input.runId);
  }
}
