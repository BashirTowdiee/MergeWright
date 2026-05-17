import {
  STAGE_PLAN_SCHEMA_VERSION,
  STAGE_PLAN_STATUSES,
  STAGE_STATUSES,
  type Stage,
  type StagePlan,
  type StagePlanSource,
  type StagePlanStatus,
  type StageStatus
} from "./stage-plan.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid stage plan: ${field} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid stage plan: ${field} must be an array`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      throw new Error(`Invalid stage plan: ${field}[${i}] must be a string`);
    }
  }
  return [...value];
}

function assertPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid stage plan: ${field} must be a positive integer`);
  }
  return value;
}

function assertStagePlanStatus(value: unknown, field: string): StagePlanStatus {
  if (typeof value !== "string" || !STAGE_PLAN_STATUSES.includes(value as StagePlanStatus)) {
    throw new Error(`Invalid stage plan: ${field} must be one of ${STAGE_PLAN_STATUSES.join(", ")}`);
  }
  return value as StagePlanStatus;
}

function assertStageStatus(value: unknown, field: string): StageStatus {
  if (typeof value !== "string" || !STAGE_STATUSES.includes(value as StageStatus)) {
    throw new Error(`Invalid stage plan: ${field} must be one of ${STAGE_STATUSES.join(", ")}`);
  }
  return value as StageStatus;
}

function assertStagePlanSource(value: unknown, field: string): StagePlanSource {
  if (value !== "generated" && value !== "imported" && value !== "manual") {
    throw new Error(`Invalid stage plan: ${field} must be one of generated, imported, manual`);
  }
  return value;
}

function parseStage(input: unknown, index: number): Stage {
  const field = `stages[${index}]`;
  if (!isRecord(input)) {
    throw new Error(`Invalid stage plan: ${field} must be an object`);
  }

  const scope = input.scope;
  if (!isRecord(scope)) {
    throw new Error(`Invalid stage plan: ${field}.scope must be an object`);
  }

  const parsed: Stage = {
    id: assertNonEmptyString(input.id, `${field}.id`),
    index: assertPositiveInteger(input.index, `${field}.index`),
    title: assertNonEmptyString(input.title, `${field}.title`),
    goal: assertNonEmptyString(input.goal, `${field}.goal`),
    status: assertStageStatus(input.status, `${field}.status`),
    dependsOn: assertStringArray(input.dependsOn, `${field}.dependsOn`),
    assumptions: assertStringArray(input.assumptions, `${field}.assumptions`),
    scope: {
      include: assertStringArray(scope.include, `${field}.scope.include`),
      exclude: assertStringArray(scope.exclude, `${field}.scope.exclude`)
    },
    acceptanceCriteria: assertStringArray(input.acceptanceCriteria, `${field}.acceptanceCriteria`),
    checks: assertStringArray(input.checks, `${field}.checks`),
    expectedOutputs: assertStringArray(input.expectedOutputs, `${field}.expectedOutputs`),
    revision: assertPositiveInteger(input.revision, `${field}.revision`)
  };

  if (parsed.acceptanceCriteria.length === 0) {
    throw new Error(`Invalid stage plan: ${field}.acceptanceCriteria must contain at least one item`);
  }

  if (input.commitSha !== undefined) {
    parsed.commitSha = assertNonEmptyString(input.commitSha, `${field}.commitSha`);
  }

  return parsed;
}

function enforceCrossStageRules(plan: StagePlan): void {
  const idToStage = new Map<string, Stage>();
  for (let i = 0; i < plan.stages.length; i += 1) {
    const stage = plan.stages[i];
    if (idToStage.has(stage.id)) {
      throw new Error(`Invalid stage plan: duplicate stage id "${stage.id}"`);
    }
    idToStage.set(stage.id, stage);
  }

  for (let i = 0; i < plan.stages.length; i += 1) {
    const stage = plan.stages[i];
    for (let depIndex = 0; depIndex < stage.dependsOn.length; depIndex += 1) {
      const depId = stage.dependsOn[depIndex];
      if (depId === stage.id) {
        throw new Error(`Invalid stage plan: stage "${stage.id}" must not depend on itself`);
      }
      const depStage = idToStage.get(depId);
      if (!depStage) {
        throw new Error(`Invalid stage plan: stage "${stage.id}" depends on missing stage "${depId}"`);
      }
      if (depStage.index >= stage.index) {
        throw new Error(
          `Invalid stage plan: stage "${stage.id}" has non-linear dependency "${depId}" (dependency index must be less than stage index)`
        );
      }
    }
  }
}

export function validateStagePlan(input: unknown): StagePlan {
  if (!isRecord(input)) {
    throw new Error("Invalid stage plan: value must be an object");
  }

  if (input.schemaVersion !== STAGE_PLAN_SCHEMA_VERSION) {
    throw new Error(`Invalid stage plan: schemaVersion must be ${STAGE_PLAN_SCHEMA_VERSION}`);
  }

  if (!Array.isArray(input.stages)) {
    throw new Error("Invalid stage plan: stages must be an array");
  }
  if (input.stages.length === 0) {
    throw new Error("Invalid stage plan: stages must contain at least one stage");
  }

  const plan: StagePlan = {
    schemaVersion: STAGE_PLAN_SCHEMA_VERSION,
    id: assertNonEmptyString(input.id, "id"),
    title: assertNonEmptyString(input.title, "title"),
    goal: assertNonEmptyString(input.goal, "goal"),
    source: assertStagePlanSource(input.source, "source"),
    status: assertStagePlanStatus(input.status, "status"),
    createdAt: assertNonEmptyString(input.createdAt, "createdAt"),
    updatedAt: assertNonEmptyString(input.updatedAt, "updatedAt"),
    stages: input.stages.map((stage, idx) => parseStage(stage, idx))
  };

  enforceCrossStageRules(plan);
  return plan;
}

export function parseStagePlanJson(json: string): StagePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid stage plan JSON: ${message}`);
  }
  return validateStagePlan(parsed);
}

export function serialiseStagePlan(plan: StagePlan): string {
  const validated = validateStagePlan(plan);
  const canonical: StagePlan = {
    schemaVersion: STAGE_PLAN_SCHEMA_VERSION,
    id: validated.id,
    title: validated.title,
    goal: validated.goal,
    source: validated.source,
    status: validated.status,
    createdAt: validated.createdAt,
    updatedAt: validated.updatedAt,
    stages: validated.stages.map((stage) => {
      const canonicalStage: Stage = {
        id: stage.id,
        index: stage.index,
        title: stage.title,
        goal: stage.goal,
        status: stage.status,
        dependsOn: [...stage.dependsOn],
        assumptions: [...stage.assumptions],
        scope: {
          include: [...stage.scope.include],
          exclude: [...stage.scope.exclude]
        },
        acceptanceCriteria: [...stage.acceptanceCriteria],
        checks: [...stage.checks],
        expectedOutputs: [...stage.expectedOutputs],
        revision: stage.revision
      };
      if (stage.commitSha !== undefined) {
        canonicalStage.commitSha = stage.commitSha;
      }
      return canonicalStage;
    })
  };

  return `${JSON.stringify(canonical, null, 2)}\n`;
}
