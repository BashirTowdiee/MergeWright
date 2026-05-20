import { formatChangeReportJson, formatChangeReportMarkdown } from "./reporting/change-report-formatters.js";
import { generateChangeReport } from "./reporting/change-report-generator.js";
import { DEFAULT_CHANGE_REPORT_POLICY } from "./reporting/change-report-policy.js";
import type { ChangeReport, ChangeReportPolicy, ChangeRiskLevel, CommitReadinessStatus } from "./reporting/change-report-types.js";
import { writeChangeReport, writePrSummary } from "./reporting/change-report-writer.js";
import { formatPrSummaryMarkdown } from "./reporting/pr-summary.js";

export type { ChangeReport, ChangeReportPolicy, ChangeRiskLevel, CommitReadinessStatus };
export { DEFAULT_CHANGE_REPORT_POLICY, formatChangeReportJson, formatChangeReportMarkdown, formatPrSummaryMarkdown, generateChangeReport, writeChangeReport, writePrSummary };

export async function generateAndWriteChangeReport(input: { runDir: string }): Promise<{
  report: ChangeReport;
  markdownPath: string;
  jsonPath: string;
}> {
  const report = await generateChangeReport({ runDir: input.runDir });
  const paths = await writeChangeReport({ runDir: input.runDir, report });
  return { report, ...paths };
}

export async function generateAndWritePrSummary(input: { runDir: string }): Promise<{
  report: ChangeReport;
  markdownPath: string;
}> {
  const report = await generateChangeReport({ runDir: input.runDir });
  const { markdownPath } = await writePrSummary({ runDir: input.runDir, report });
  return { report, markdownPath };
}
