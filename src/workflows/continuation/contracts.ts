import type { RunPhaseName, RunPhaseStatus } from "../../run-metadata.js";
import type { ProgressLogger } from "../../progress-logger.js";
import type { AgentExecutor } from "../../agent-executor.js";
import type { executeCheckCommand } from "../../commands.js";
import type { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "../../write-audit.js";
import type { writeRunMetadata } from "../../run-metadata.js";

export interface ContinueOptions {
  runId: string;
  configArg: string;
  executeBuilder?: boolean;
  executeReviewer?: boolean;
  planFix?: boolean;
  executeFix?: boolean;
  runChecks?: boolean;
  allowWrites?: boolean;
  streamCodex?: boolean;
  dryRun: boolean;
  verbose: boolean;
  orchestratorRoot: string;
  progressLogger?: ProgressLogger;
  codexExecutor?: AgentExecutor;
  writeAuditPreCapture?: typeof captureWriteAuditPreState;
  writeAuditPostCapture?: typeof captureWriteAuditPostStateAndWriteArtefacts;
  checkCommandExecutor?: typeof executeCheckCommand;
  metadataWriter?: typeof writeRunMetadata;
  planHtml?: boolean;
}

export interface ContinueResult {
  runId: string;
  runDir: string;
  configPath: string;
  dryRun: boolean;
  selectedPhases: string[];
  before: Record<RunPhaseName, RunPhaseStatus>;
  after: Record<RunPhaseName, RunPhaseStatus>;
  artefacts: string[];
  skippedFixBecauseProceed: boolean;
  allowWrites: boolean;
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run";
  writeEnabledPhases: Array<"builder" | "fix">;
}

export type ContinuePhase = "builder" | "reviewer" | "fixPlanning" | "fixExecution" | "checks";
