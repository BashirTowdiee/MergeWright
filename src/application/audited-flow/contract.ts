export type AuditedFlowStageKind =
  | "plan"
  | "build"
  | "check"
  | "review"
  | "fix"
  | "final-review"
  | "approval"
  | "report"
  | "github";

export interface RunContract {
  id?: string;
  goal: string;
  workspace: string;
  flow: string;
  stages: RunContractStage[];
  requiredChecks?: string[];
  requiredEvidence?: string[];
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  stopBeforePr?: boolean;
  audit?: {
    mode: "required" | "best-effort";
  };
}

export interface RunContractStage {
  id: string;
  kind: AuditedFlowStageKind;
  executor: string;
  model?: string;
  required?: boolean;
  onlyIf?: string[];
}
