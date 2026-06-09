import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditedFlowStageKind } from "./contract.js";
import type { StageExecutor, StageInput, StageResult } from "./stage-executor.js";

const SUPPORTED_STAGE_KINDS: AuditedFlowStageKind[] = [
  "plan",
  "build",
  "check",
  "review",
  "fix",
  "final-review",
  "approval",
  "report",
  "github"
];

export class DeterministicStageExecutor implements StageExecutor {
  readonly id = "deterministic-dry-run";

  readonly capabilities = {
    stageKinds: SUPPORTED_STAGE_KINDS,
    writesWorkspace: false,
    streamsOutput: false
  } as const;

  async run(input: StageInput): Promise<StageResult> {
    const stageDir = path.resolve(input.artefactsDir);
    await mkdir(stageDir, { recursive: true });

    const artefactRelativePath = "stage-result.json";
    const artefactPath = path.join(stageDir, artefactRelativePath);
    const summary = `Dry-run ${input.stage.kind} stage ${input.stage.id} completed with deterministic executor.`;

    await writeFile(
      artefactPath,
      `${JSON.stringify(
        {
          runId: input.runId,
          stageId: input.stage.id,
          kind: input.stage.kind,
          executor: this.id,
          dryRun: input.dryRun ?? false,
          previousStageIds: input.previousResults.map((result) => result.stageId),
          summary
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    return {
      stageId: input.stage.id,
      kind: input.stage.kind,
      executor: this.id,
      status: "passed",
      summary,
      artefacts: [{ kind: "json", path: artefactRelativePath }],
      metadata: {
        dryRun: input.dryRun ?? false,
        previousStageCount: input.previousResults.length
      }
    };
  }
}
