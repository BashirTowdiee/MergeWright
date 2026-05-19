import path from "node:path";
import type { initProject } from "../../init-project.js";

export function formatInitProjectSummaryLines(result: Awaited<ReturnType<typeof initProject>>, orchestratorRoot: string): string[] {
  const configDisplay = path.relative(orchestratorRoot, result.configPath) || result.configPath;
  return [
    "Project initialization summary",
    `- project name: ${result.projectName}`,
    `- project slug: ${result.projectSlug}`,
    `- workspace path: ${result.workspacePath}`,
    `- config path: ${result.configPath}`,
    `- stages path: ${result.stagesPath}`,
    `- runs path: ${result.runsPath}`,
    `- example run command: npm run agent -- run example-stage --config ${configDisplay} --preset plan --dry-run`
  ];
}
