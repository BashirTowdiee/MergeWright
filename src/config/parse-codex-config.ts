import { assertObject, assertString } from "../validation.js";
import type { AgentConfigMap, OrchestratorConfig } from "./types.js";

export function parseCodexConfig(raw: Record<string, unknown>): OrchestratorConfig["codex"] {
  const planner = assertObject(raw.planner, "codex.planner");
  const builder = assertObject(raw.builder, "codex.builder");
  const reviewer = assertObject(raw.reviewer, "codex.reviewer");

  return {
    planner: {
      model: assertString(planner.model, "codex.planner.model"),
      reasoningEffort: assertString(planner.reasoningEffort, "codex.planner.reasoningEffort")
    },
    builder: {
      model: assertString(builder.model, "codex.builder.model"),
      reasoningEffort: assertString(builder.reasoningEffort, "codex.builder.reasoningEffort")
    },
    reviewer: {
      model: assertString(reviewer.model, "codex.reviewer.model"),
      reasoningEffort: assertString(reviewer.reasoningEffort, "codex.reviewer.reasoningEffort")
    }
  };
}

export function codexFromAgents(agents: AgentConfigMap): OrchestratorConfig["codex"] {
  return {
    planner: {
      model: agents.planner.model,
      reasoningEffort: agents.planner.reasoningEffort
    },
    builder: {
      model: agents.builder.model,
      reasoningEffort: agents.builder.reasoningEffort
    },
    reviewer: {
      model: agents.reviewer.model,
      reasoningEffort: agents.reviewer.reasoningEffort
    }
  };
}
