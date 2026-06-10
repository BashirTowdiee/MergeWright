import type { RunContract, RunContractStage, AuditedFlowStageKind } from "./contract.js";

export const DEFAULT_AUDITED_FLOW_EXECUTOR = "deterministic-dry-run";

export interface DefaultAuditedFlowStageInput {
  id: string;
  kind: AuditedFlowStageKind;
  executor?: string;
  model?: string;
  required?: boolean;
  onlyIf?: string[];
}

export interface BuildDefaultAuditedFlowContractInput {
  goal: string;
  workspace: string;
  flow?: string;
  auditMode?: NonNullable<RunContract["audit"]>["mode"];
  stages?: readonly DefaultAuditedFlowStageInput[];
  requiredChecks?: readonly string[];
}

export const DEFAULT_AUDITED_FLOW_STAGES: readonly DefaultAuditedFlowStageInput[] = [
  { id: "plan", kind: "plan", executor: DEFAULT_AUDITED_FLOW_EXECUTOR, model: "gpt-5.5-medium" },
  { id: "build", kind: "build", executor: DEFAULT_AUDITED_FLOW_EXECUTOR, model: "gpt-5.5-xhigh" },
  { id: "check", kind: "check", executor: DEFAULT_AUDITED_FLOW_EXECUTOR },
  { id: "review", kind: "review", executor: DEFAULT_AUDITED_FLOW_EXECUTOR, model: "configured-review-model" },
  { id: "final-review", kind: "final-review", executor: DEFAULT_AUDITED_FLOW_EXECUTOR, model: "configured-final-review-model" }
] as const;

export function buildDefaultAuditedFlowContract(input: BuildDefaultAuditedFlowContractInput): RunContract {
  return {
    goal: input.goal.trim(),
    workspace: input.workspace,
    flow: input.flow?.trim() || "feature-standard",
    requiredChecks: input.requiredChecks ? [...input.requiredChecks] : undefined,
    audit: {
      mode: input.auditMode ?? "required"
    },
    stages: (input.stages ?? DEFAULT_AUDITED_FLOW_STAGES).map(toRunContractStage)
  };
}

function toRunContractStage(stage: DefaultAuditedFlowStageInput): RunContractStage {
  return {
    id: stage.id,
    kind: stage.kind,
    executor: stage.executor ?? DEFAULT_AUDITED_FLOW_EXECUTOR,
    model: stage.model,
    required: stage.required,
    onlyIf: stage.onlyIf
  };
}
