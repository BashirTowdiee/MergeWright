import type { RunContract } from "./contract.js";

export function validateRunContract(contract: RunContract): string[] {
  const errors: string[] = [];

  if (!contract.goal.trim()) {
    errors.push("Run contract goal is required.");
  }
  if (!contract.workspace.trim()) {
    errors.push("Run contract workspace is required.");
  }
  if (!contract.flow.trim()) {
    errors.push("Run contract flow is required.");
  }
  if (!Array.isArray(contract.stages) || contract.stages.length === 0) {
    errors.push("Run contract must define at least one stage.");
    return errors;
  }

  const seenStageIds = new Set<string>();
  for (const stage of contract.stages) {
    if (!stage.id.trim()) {
      errors.push("Run contract stage id is required.");
      continue;
    }
    if (seenStageIds.has(stage.id)) {
      errors.push(`Run contract stage ids must be unique. Duplicate: ${stage.id}`);
    }
    seenStageIds.add(stage.id);

    if (!stage.executor.trim()) {
      errors.push(`Run contract stage ${stage.id} must define an executor.`);
    }
  }

  return errors;
}
