import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Stage, StagePlan } from "../../stage-plan.js";

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writePhaseOutputs(stageArtefactsDir: string, runDir: string): Promise<void> {
  await copyIfExists(path.join(runDir, "06-planner-output-last-message.md"), path.join(stageArtefactsDir, "planner-output.md"));
  await copyIfExists(path.join(runDir, "builder-output-last-message.md"), path.join(stageArtefactsDir, "builder-output.md"));
  await copyIfExists(path.join(runDir, "reviewer-output-last-message.md"), path.join(stageArtefactsDir, "reviewer-output.md"));

  const checksStatusPath = path.join(runDir, "checks-status.json");
  try {
    const raw = await readFile(checksStatusPath, "utf8");
    await writeFile(path.join(stageArtefactsDir, "checks-output.txt"), raw, "utf8");
  } catch {
    // checks may be disabled or unavailable; keep stage artefact set best-effort
  }
}

async function copyIfExists(fromPath: string, toPath: string): Promise<void> {
  try {
    const content = await readFile(fromPath, "utf8");
    await writeFile(toPath, content, "utf8");
  } catch {
    // optional artefact
  }
}

export async function writeStageReport(args: {
  stageArtefactsDir: string;
  plan: StagePlan;
  stage: Stage;
  runDir?: string;
  finalStatus: "review_required" | "failed" | "accepted" | "committed";
  failure?: unknown;
  commitSha?: string;
}): Promise<void> {
  await mkdir(args.stageArtefactsDir, { recursive: true });
  const failureMessage = args.failure == null ? undefined : args.failure instanceof Error ? args.failure.message : String(args.failure);
  const lines = [
    `# Stage Report: ${args.stage.id}`,
    "",
    `- plan: ${args.plan.title}`,
    `- stage: ${args.stage.id} (${args.stage.title})`,
    `- status: ${args.finalStatus}`,
    `- revision: ${args.stage.revision}`,
    `- updatedAt: ${new Date().toISOString()}`,
    `- runDir: ${args.runDir ?? "(not available)"}`
  ];
  if (args.commitSha) lines.push(`- commitSha: ${args.commitSha}`);
  if (failureMessage) lines.push(`- error: ${failureMessage}`);
  lines.push(
    "",
    "## Artefacts",
    "- stage.json",
    "- stage-prompt.md",
    "- planner-output.md (if planner ran)",
    "- builder-output.md (if builder ran)",
    "- reviewer-output.md (if reviewer ran)",
    "- checks-output.txt (if checks ran)"
  );
  await writeFile(path.join(args.stageArtefactsDir, "stage-report.md"), `${lines.join("\n")}\n`, "utf8");
}
