import Script from "next/script";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function loadShellHtml(): Promise<string> {
  const shellPath = path.join(process.cwd(), "app", "shell.html");
  return readFile(shellPath, "utf8");
}

export default async function Page() {
  const shellHtml = await loadShellHtml();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3040";

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: shellHtml }} />
      <Script id="api-base-url" strategy="beforeInteractive">
        {`window.__MERGEWRIGHT_API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`}
      </Script>
      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
