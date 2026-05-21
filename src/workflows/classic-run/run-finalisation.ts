import { writePlanHtmlFromRun } from "../../plan-html.js";
import type { ProgressLogger } from "../../progress-logger.js";
import { addRunArtefact, markRunSuccess, toRunRelativePath, type RunMetadata } from "../../run-metadata.js";
import { finaliseClassicRunEvidence } from "./run-evidence-finalisation.js";

export async function finaliseClassicRunSuccess(input: {
  runDir: string;
  artefacts: Record<string, string>;
  metadata: RunMetadata;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  persistMetadata: () => Promise<void>;
  planHtml: boolean;
  progressLogger: ProgressLogger;
}): Promise<string[]> {
  const written = await input.writeArtefacts(input.runDir, input.artefacts);
  if (input.planHtml) {
    const planHtmlPath = await writePlanHtmlFromRun(
      input.runDir,
      input.metadata,
      written.map((filePath) => toRunRelativePath(input.runDir, filePath))
    );
    written.push(planHtmlPath);
    input.progressLogger.artefact("plan html", planHtmlPath);
  }
  for (const artefact of written) {
    addRunArtefact(input.metadata, toRunRelativePath(input.runDir, artefact));
  }
  markRunSuccess(input.metadata);
  await finaliseClassicRunEvidence({ runDir: input.runDir, status: "pass" });
  await input.persistMetadata();
  return written;
}
