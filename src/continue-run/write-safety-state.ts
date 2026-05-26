import type { RunMetadata } from "../run-metadata.js";

export type ContinueWriteSafetyMetadata = NonNullable<RunMetadata["writeSafety"]>;
export type ContinueWriteSafetyState = ContinueWriteSafetyMetadata["state"];

export const WRITE_SAFETY_RESULT_ARTEFACT = "write-safety-result.json";

export function initialContinueWriteSafetyState(allowWrites: boolean, dryRun: boolean): ContinueWriteSafetyState {
  return allowWrites && dryRun ? "skipped by dry-run" : "not checked";
}

export function createContinueWriteSafetyMetadata(input: {
  existing?: ContinueWriteSafetyMetadata;
  allowWrites: boolean;
  state: ContinueWriteSafetyState;
  reason?: string;
  artefacts?: readonly string[];
}): ContinueWriteSafetyMetadata {
  const next: ContinueWriteSafetyMetadata = {
    ...(input.existing ?? { allowWrites: input.allowWrites }),
    allowWrites: input.allowWrites,
    state: input.state
  };

  if (input.state === "skipped by dry-run") {
    next.status = "skipped";
  }
  if (input.state === "passed" || input.state === "failed") {
    next.status = input.state;
  }
  if (input.reason) {
    next.reason = input.reason;
  }
  if (input.artefacts && input.artefacts.length > 0) {
    next.artefacts = [...input.artefacts];
  }

  return next;
}
