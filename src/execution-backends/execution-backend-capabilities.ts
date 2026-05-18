import type { AgentRole, ExecutionBackend } from "./execution-backend-types.js";

export interface BackendPhaseRequirement {
  supportsLocalWorkspace?: true;
  supportsFileEdits?: true;
  supportsShellCommands?: true;
  supportsSandboxMode?: true;
  supportsStreaming?: true;
  supportsReasoningEffort?: true;
  supportsModelSelection?: true;
}

export function getBackendPhaseRequirement(role: AgentRole): BackendPhaseRequirement {
  switch (role) {
    case "planner":
    case "reviewer":
    case "fix-planner":
    case "reassessor":
      return {
        supportsLocalWorkspace: true,
        supportsSandboxMode: true,
        supportsModelSelection: true
      };
    case "builder":
    case "fixer":
      return {
        supportsLocalWorkspace: true,
        supportsFileEdits: true,
        supportsShellCommands: true,
        supportsSandboxMode: true,
        supportsModelSelection: true
      };
  }
}

export function getBackendDryRunPhaseRequirement(role: AgentRole): BackendPhaseRequirement {
  switch (role) {
    case "planner":
    case "reviewer":
    case "fix-planner":
    case "reassessor":
      return {
        supportsLocalWorkspace: true,
        supportsModelSelection: true
      };
    case "builder":
    case "fixer":
      return getBackendPhaseRequirement(role);
  }
}

export function validateBackendCapabilitiesForRole(input: {
  backendName: string;
  backend: ExecutionBackend;
  role: AgentRole;
}): void {
  validateBackendCapabilities(input.backendName, input.backend, input.role, getBackendPhaseRequirement(input.role));
}

export function validateBackendCapabilitiesForRoleExecution(input: {
  backendName: string;
  backend: ExecutionBackend;
  role: AgentRole;
  dryRun: boolean;
}): void {
  const requirement = input.dryRun ? getBackendDryRunPhaseRequirement(input.role) : getBackendPhaseRequirement(input.role);
  validateBackendCapabilities(input.backendName, input.backend, input.role, requirement);
}

function validateBackendCapabilities(
  backendName: string,
  backend: ExecutionBackend,
  role: AgentRole,
  requirement: BackendPhaseRequirement
): void {
  const missing = Object.entries(requirement)
    .filter(([, required]) => required)
    .map(([capability]) => capability as keyof BackendPhaseRequirement)
    .filter((capability) => backend.capabilities[capability] !== true);

  if (missing.length > 0) {
    throw new Error(
      `Execution backend "${backendName}" of type "${backend.type}" cannot run role "${role}". Missing capabilities: ${missing.join(", ")}.`
    );
  }
}
