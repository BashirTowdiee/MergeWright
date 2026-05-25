import type { RunDetail, RunSummary } from "../read-models/run-read-model.js";
import type { RunReadRepository } from "./run-query-service.js";

export interface InMemoryRunReadRepositoryInput {
  runs: RunSummary[];
  runDetailsById: Record<string, RunDetail>;
}

export class InMemoryRunReadRepository implements RunReadRepository {
  private readonly runs: RunSummary[];
  private readonly runDetailsById: Record<string, RunDetail>;

  constructor(input: InMemoryRunReadRepositoryInput) {
    this.runs = [...input.runs];
    this.runDetailsById = { ...input.runDetailsById };
  }

  async listRuns(): Promise<RunSummary[]> {
    return [...this.runs];
  }

  async getRun(runId: string): Promise<RunDetail | null> {
    return this.runDetailsById[runId] ?? null;
  }
}
