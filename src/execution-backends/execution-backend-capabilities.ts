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

export function validateBackendCapabilitiesForRole(input: {
  backendName: string;
  backend: ExecutionBackend;
  role: AgentRole;
}): void {
  const requirement = getBackendPhaseRequirement(input.role);
  const missing = Object.entries(requirement)
    .filter(([, required]) => required)
    .map(([capability]) => capability as keyof BackendPhaseRequirement)
    .filter((capability) => input.backend.capabilities[capability] !== true);

  if (missing.length > 0) {
    throw new Error(
      `Execution backend "${input.backendName}" of type "${input.backend.type}" cannot run role "${input.role}". Missing capabilities: ${missing.join(", ")}.`
    );
  }
}
