import { createCompareRunsReport } from "../../reporting/compare-runs.js";
import { generateChangeReport } from "../../reporting/change-report-generator.js";
import type { ChangeReportPolicy } from "../../reporting/change-report-types.js";
import type { RunComparisonView } from "../read-models/run-comparison-read-model.js";
import type { RunQueryService } from "./run-query-service.js";

export interface CompareRunsInput {
  readonly runIdA: string;
  readonly runIdB: string;
}

export interface RunComparisonQueryService {
  compareRuns(input: CompareRunsInput): Promise<RunComparisonView | null>;
}

export interface DefaultRunComparisonQueryServiceOptions {
  readonly runQueryService: RunQueryService;
  readonly changeReportPolicy?: ChangeReportPolicy;
}

export class DefaultRunComparisonQueryService implements RunComparisonQueryService {
  private readonly runQueryService: RunQueryService;
  private readonly changeReportPolicy: ChangeReportPolicy | undefined;

  constructor(options: DefaultRunComparisonQueryServiceOptions) {
    this.runQueryService = options.runQueryService;
    this.changeReportPolicy = options.changeReportPolicy;
  }

  async compareRuns(input: CompareRunsInput): Promise<RunComparisonView | null> {
    const runIdA = input.runIdA.trim();
    const runIdB = input.runIdB.trim();
    if (!runIdA || !runIdB || runIdA === runIdB) {
      return null;
    }

    const [runA, runB] = await Promise.all([
      this.runQueryService.getRun({ runId: runIdA }),
      this.runQueryService.getRun({ runId: runIdB })
    ]);
    if (!runA || !runB) {
      return null;
    }

    const [reportA, reportB] = await Promise.all([
      generateChangeReport({ runDir: runA.runDir, policy: this.changeReportPolicy }),
      generateChangeReport({ runDir: runB.runDir, policy: this.changeReportPolicy })
    ]);

    return createCompareRunsReport(reportA, reportB);
  }
}
