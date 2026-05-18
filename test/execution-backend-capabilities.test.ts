import test from "node:test";
import assert from "node:assert/strict";
import {
  getBackendDryRunPhaseRequirement,
  getBackendPhaseRequirement,
  validateBackendCapabilitiesForRole,
  validateBackendCapabilitiesForRoleExecution
} from "../src/execution-backends/execution-backend-capabilities.js";
import { OpenCodeCliBackend } from "../src/execution-backends/opencode-cli-backend.js";
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

test("dry-run read-only roles require local workspace and model selection only", () => {
  assert.deepEqual(getBackendDryRunPhaseRequirement("planner"), {
    supportsLocalWorkspace: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendDryRunPhaseRequirement("reviewer"), {
    supportsLocalWorkspace: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendDryRunPhaseRequirement("fix-planner"), {
    supportsLocalWorkspace: true,
    supportsModelSelection: true
  });
  assert.deepEqual(getBackendDryRunPhaseRequirement("reassessor"), {
    supportsLocalWorkspace: true,
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

test("dry-run write roles keep full write-role requirements", () => {
  assert.deepEqual(getBackendDryRunPhaseRequirement("builder"), getBackendPhaseRequirement("builder"));
  assert.deepEqual(getBackendDryRunPhaseRequirement("fixer"), getBackendPhaseRequirement("fixer"));
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

test("dry-run capability validation allows OpenCode read-only roles", () => {
  for (const role of ["planner", "reviewer", "fix-planner", "reassessor"] as const) {
    assert.doesNotThrow(() =>
      validateBackendCapabilitiesForRoleExecution({
        backendName: "opencode-reviewer",
        backend: new OpenCodeCliBackend(),
        role,
        dryRun: true
      })
    );
  }
});

test("dry-run capability validation still rejects OpenCode write roles", () => {
  for (const role of ["builder", "fixer"] as const) {
    assert.throws(
      () =>
        validateBackendCapabilitiesForRoleExecution({
          backendName: "opencode-reviewer",
          backend: new OpenCodeCliBackend(),
          role,
          dryRun: true
        }),
      /Missing capabilities: supportsFileEdits, supportsShellCommands, supportsSandboxMode\./
    );
  }
});

test("real execution capability validation still rejects OpenCode read-only roles without sandbox", () => {
  assert.throws(
    () =>
      validateBackendCapabilitiesForRoleExecution({
        backendName: "opencode-reviewer",
        backend: new OpenCodeCliBackend(),
        role: "planner",
        dryRun: false
      }),
    /Missing capabilities: supportsSandboxMode\./
  );
});
