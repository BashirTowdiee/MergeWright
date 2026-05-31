import Script from "next/script";
import { readFile } from "node:fs/promises";
import path from "node:path";

interface RouteContext {
  page: string;
  runId?: string;
}

async function loadShellHtml(): Promise<string> {
  const fragmentsRoot = path.join(process.cwd(), "app", "_fragments");
  const sectionsRoot = path.join(fragmentsRoot, "sections");
  const [sidebar, topbar, projects, runs, stagePlans, runDetail, results, review, compare, commands, team, settings] =
    await Promise.all([
      readFile(path.join(fragmentsRoot, "sidebar.html"), "utf8"),
      readFile(path.join(fragmentsRoot, "topbar.html"), "utf8"),
      readFile(path.join(sectionsRoot, "projects.html"), "utf8"),
      readFile(path.join(sectionsRoot, "runs.html"), "utf8"),
      readFile(path.join(sectionsRoot, "stage-plans.html"), "utf8"),
      readFile(path.join(sectionsRoot, "run-detail.html"), "utf8"),
      readFile(path.join(sectionsRoot, "results.html"), "utf8"),
      readFile(path.join(sectionsRoot, "review.html"), "utf8"),
      readFile(path.join(sectionsRoot, "compare.html"), "utf8"),
      readFile(path.join(sectionsRoot, "commands.html"), "utf8"),
      readFile(path.join(sectionsRoot, "team.html"), "utf8"),
      readFile(path.join(sectionsRoot, "settings.html"), "utf8"),
    ]);

  return `<div class="app">${sidebar}<main class="main">${topbar}<div class="content">${projects}${runs}${stagePlans}${runDetail}${results}${review}${compare}${commands}${team}${settings}</div></main></div>`;
}

export async function ControlRoomShell({ route }: { route: RouteContext }) {
  const shellHtml = await loadShellHtml();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: shellHtml }} />
      <Script id="api-base-url" strategy="beforeInteractive">
        {`window.__MERGEWRIGHT_API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`}
      </Script>
      <Script id="route-context" strategy="beforeInteractive">
        {`window.__MERGEWRIGHT_WEB_ROUTE__ = ${JSON.stringify(route)};`}
      </Script>
      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
