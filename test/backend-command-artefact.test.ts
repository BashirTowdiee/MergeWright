import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBackendCommandArtefact,
  serialiseBackendCommandArtefact
} from "../src/execution-backends/backend-command-artefact.js";

test("backend command artefact preserves existing command shape when metadata is absent", () => {
  assert.deepEqual(
    buildBackendCommandArtefact({
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true
    }),
    {
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true
    }
  );
});

test("backend command artefact includes sandbox mode when supplied", () => {
  assert.deepEqual(
    buildBackendCommandArtefact({
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true,
      sandboxMode: "workspace-write"
    }),
    {
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true,
      sandboxMode: "workspace-write"
    }
  );
});

test("backend command artefact includes backend metadata when supplied", () => {
  assert.deepEqual(
    buildBackendCommandArtefact({
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true,
      sandboxMode: "read-only",
      backend: {
        backendName: "codex-local",
        backendType: "codex-cli",
        agentRole: "planner",
        model: "agent-planner-model",
        reasoningEffort: "high"
      }
    }),
    {
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true,
      sandboxMode: "read-only",
      backend: {
        backendName: "codex-local",
        backendType: "codex-cli",
        agentRole: "planner",
        model: "agent-planner-model",
        reasoningEffort: "high"
      }
    }
  );
});

test("backend command artefact serialises with stable JSON formatting", () => {
  assert.equal(
    serialiseBackendCommandArtefact({
      command: "codex",
      args: ["exec"],
      cwd: "/tmp/orchestrator",
      outputLastMessagePath: "/tmp/run/out.md",
      promptViaStdin: true,
      backend: {
        backendName: "codex-local",
        backendType: "codex-cli",
        agentRole: "reviewer",
        model: "agent-reviewer-model",
        reasoningEffort: "high"
      }
    }),
    JSON.stringify(
      {
        command: "codex",
        args: ["exec"],
        cwd: "/tmp/orchestrator",
        outputLastMessagePath: "/tmp/run/out.md",
        promptViaStdin: true,
        backend: {
          backendName: "codex-local",
          backendType: "codex-cli",
          agentRole: "reviewer",
          model: "agent-reviewer-model",
          reasoningEffort: "high"
        }
      },
      null,
      2
    )
  );
});
