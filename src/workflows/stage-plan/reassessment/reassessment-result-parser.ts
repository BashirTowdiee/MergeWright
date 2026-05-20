import { getDownstreamStages } from "./downstream-selector.js";
import type { Stage, StagePlan } from "../../../stage-plan.js";

export type ReassessmentClassification = "unchanged" | "needs_revision" | "invalidated";

export interface ReassessmentResultItem {
  stageId: string;
  classification: ReassessmentClassification;
  reason: string;
}

export interface ReassessmentResult {
  sourceStageId: string;
  results: ReassessmentResultItem[];
}

export function parseReassessmentOutput(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Reassessment output parse error: empty model output.");
  }

  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Reassessment output parse error: invalid JSON. ${message}`);
  }
}

export function validateReassessmentResult(
  plan: StagePlan,
  sourceStageId: string,
  value: unknown,
  downstreamStagesInput?: Stage[]
): ReassessmentResult {
  const downstreamStages = downstreamStagesInput ?? getDownstreamStages(plan, sourceStageId);
  const downstreamById = new Map(downstreamStages.map((stage) => [stage.id, stage] as const));

  if (!isRecord(value)) {
    throw new Error("Reassessment result validation failed: JSON root must be an object.");
  }
  if (value.sourceStageId !== sourceStageId) {
    throw new Error(`Reassessment result validation failed: sourceStageId must equal "${sourceStageId}".`);
  }
  if (!Array.isArray(value.results)) {
    throw new Error('Reassessment result validation failed: "results" must be an array.');
  }

  const seen = new Set<string>();
  const results: ReassessmentResultItem[] = [];

  for (let i = 0; i < value.results.length; i += 1) {
    const item = value.results[i];
    if (!isRecord(item)) {
      throw new Error(`Reassessment result validation failed: results[${i}] must be an object.`);
    }
    const stageId = item.stageId;
    const classification = item.classification;
    const reason = item.reason;

    if (typeof stageId !== "string" || stageId.trim().length === 0) {
      throw new Error(`Reassessment result validation failed: results[${i}].stageId must be a non-empty string.`);
    }
    if (seen.has(stageId)) {
      throw new Error(`Reassessment result validation failed: duplicate stageId "${stageId}".`);
    }
    seen.add(stageId);

    if (!downstreamById.has(stageId)) {
      const existsInPlan = plan.stages.some((stage) => stage.id === stageId);
      if (existsInPlan) {
        throw new Error(`Reassessment result validation failed: stageId "${stageId}" is not downstream of "${sourceStageId}".`);
      }
      throw new Error(`Reassessment result validation failed: unknown result stageId "${stageId}".`);
    }

    if (classification !== "unchanged" && classification !== "needs_revision" && classification !== "invalidated") {
      throw new Error(
        `Reassessment result validation failed: results[${i}].classification must be one of unchanged, needs_revision, invalidated.`
      );
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new Error(`Reassessment result validation failed: results[${i}].reason must be non-empty.`);
    }

    results.push({ stageId, classification, reason: reason.trim() });
  }

  for (const stage of downstreamStages) {
    if (!seen.has(stage.id)) {
      throw new Error(`Reassessment result validation failed: missing downstream result for stage "${stage.id}".`);
    }
  }

  return {
    sourceStageId,
    results
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
