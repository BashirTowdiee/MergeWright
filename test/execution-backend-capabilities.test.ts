import test from "node:test";
import assert from "node:assert/strict";
import {
  getBackendPhaseRequirement,
  validateBackendCapabilitiesForRole
} from "../src/execution-backends/execution-backend-capabilities.js";
import type { ExecutionBackend } from "../src/execution-backends/execution-backend-types.js";

function makeBackend(overrides: Partial<ExecutionBackend["capabilities"]> = {}): ExecutionBackend {
  return {
    type: "codex-cli",
    capabilities: {
      providesHarness: true,
      supportsLocalWorkspace: true,
      supportsFileEdits: true,
      supportsShellCommands: true,
      supportsSandboxMode: true,
      supportsStreaming: true,
      supportsReasoningEffort: true,
      supportsModelSelection: true,
      ...overrides
    },
    async execute(request) {
      return {
        backendName: request.backendName,
        backendType: request.backendType,
        model: request.model,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 0,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "",
        skipped: false
      };
    }
  };
}

test("read-only roles require local workspace, sandbox, and model selection", () => {
  assert.deepEqual(getBackendPhaseRequirement("planner"), {
    supportsLocalWorkspace: true,
    supportsSandboxMode: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendPhaseRequirement("reviewer"), {
    supportsLocalWorkspace: true,
    supportsSandboxMode: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendPhaseRequirement("fix-planner"), {
    supportsLocalWorkspace: true,
    supportsSandboxMode: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendPhaseRequirement("reassessor"), {
    supportsLocalWorkspace: true,
    supportsSandboxMode: true,
    supportsModelSelection: true
  });
});

test("write roles require file edit and shell capabilities", () => {
  assert.deepEqual(getBackendPhaseRequirement("builder"), {
    supportsLocalWorkspace: true,
    supportsFileEdits: true,
    supportsShellCommands: true,
    supportsSandboxMode: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendPhaseRequirement("fixer"), {
    supportsLocalWorkspace: true,
    supportsFileEdits: true,
    supportsShellCommands: true,
    supportsSandboxMode: true,
    supportsModelSelection: true
  });
});

test("capability validation passes when backend satisfies role requirements", () => {
  assert.doesNotThrow(() =>
    validateBackendCapabilitiesForRole({
      backendName: "codex",
      backend: makeBackend(),
      role: "builder"
    })
  );
});

test("capability validation reports missing capabilities", () => {
  assert.throws(
    () =>
      validateBackendCapabilitiesForRole({
        backendName: "codex",
        backend: makeBackend({ supportsFileEdits: false, supportsShellCommands: false }),
        role: "builder"
      }),
    /Execution backend "codex" of type "codex-cli" cannot run role "builder"\. Missing capabilities: supportsFileEdits, supportsShellCommands\./
  );
});

test("capability validation allows read-only roles without file edit support", () => {
  assert.doesNotThrow(() =>
    validateBackendCapabilitiesForRole({
      backendName: "codex",
      backend: makeBackend({ supportsFileEdits: false, supportsShellCommands: false }),
      role: "planner"
    })
  );
});
