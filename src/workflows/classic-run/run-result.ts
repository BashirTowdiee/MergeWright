export function buildClassicRunResult(input: {
  stageName: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  configPath: string;
  runDir: string;
  artefacts: string[];
  dryRun: boolean;
  checksState: "disabled" | "skipped by dry-run" | "executed" | "failed";
  allowWrites: boolean;
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run";
  writeEnabledPhases: Array<"builder" | "fix">;
}): {
  stageName: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  configPath: string;
  runDir: string;
  artefacts: string[];
  dryRun: boolean;
  checksState: "disabled" | "skipped by dry-run" | "executed" | "failed";
  allowWrites: boolean;
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run";
  writeEnabledPhases: Array<"builder" | "fix">;
} {
  return {
    stageName: input.stageName,
    orchestratorRoot: input.orchestratorRoot,
    targetWorkspaceRoot: input.targetWorkspaceRoot,
    configPath: input.configPath,
    runDir: input.runDir,
    artefacts: input.artefacts,
    dryRun: input.dryRun,
    checksState: input.checksState,
    allowWrites: input.allowWrites,
    writeSafetyState: input.writeSafetyState,
    writeEnabledPhases: input.writeEnabledPhases
  };
}
