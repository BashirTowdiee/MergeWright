import path from "node:path";
import { buildDefaultAuditedFlowContract } from "../../application/audited-flow/default-run-contract.js";
import { DeterministicStageExecutor } from "../../application/audited-flow/deterministic-stage-executor.js";
import type { RunContract } from "../../application/audited-flow/contract.js";
import { StageExecutorRegistry } from "../../application/audited-flow/executor-registry.js";
import { DefaultExecuteAuditedFlowUseCase } from "../../application/use-cases/execute-audited-flow-use-case.js";
import type { CommandHandler } from "../command-context.js";

export const handleRunContractCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, deps }) => {
  if (!args.goalArg?.trim()) {
    throw new Error("run-contract requires --goal <text>.");
  }
  if (!args.workspaceArg?.trim()) {
    throw new Error("run-contract requires --workspace <path>.");
  }

  const contract = buildExampleRunContract({
    goal: args.goalArg,
    workspace: path.resolve(args.workspaceArg),
    flow: args.flowArg?.trim() || "feature-standard"
  });

  const handler =
    deps.runContractHandler ??
    (async (input: { contract: RunContract; orchestratorRoot: string; dryRun: boolean }) =>
      new DefaultExecuteAuditedFlowUseCase({
        executorRegistry: new StageExecutorRegistry([new DeterministicStageExecutor()])
      }).execute({
        contract: input.contract,
        orchestratorRoot: input.orchestratorRoot,
        dryRun: input.dryRun
      }));

  const result = await handler({
    contract,
    orchestratorRoot,
    dryRun: args.dryRun
  });

  writeLine(`audited flow run id: ${result.runId}`);
  writeLine(`status: ${result.status}`);
  writeLine(`audit path: ${result.auditPath}`);
  writeLine(`artefacts: ${result.artefactsDir}`);
}

function buildExampleRunContract(input: { goal: string; workspace: string; flow: string }): RunContract {
  return buildDefaultAuditedFlowContract(input);
}
