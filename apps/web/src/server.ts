#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

interface WebServerOptions {
  host: string;
  port: number;
  apiBaseUrl: string;
  publicDir: string;
}

async function main(): Promise<void> {
  const options = parseWebServerOptions(process.argv.slice(2), process.cwd());

  const server = createServer(async (request, response) => {
    try {
      if (!request.url) {
        writeText(response, 400, "Bad request");
        return;
      }

      if (request.url.startsWith("/api/")) {
        await proxyApiRequest(request, response, options.apiBaseUrl);
        return;
      }

      await serveStaticAsset(request.url, response, options.publicDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeText(response, 500, `Internal server error: ${message}`);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve());
  });

  console.log(`MergeWright web app listening on http://${options.host}:${options.port}`);
  console.log(`Proxying /api/* to ${options.apiBaseUrl}`);
}

function parseWebServerOptions(argv: string[], cwd: string): WebServerOptions {
  const options: WebServerOptions = {
    host: "127.0.0.1",
    port: 3050,
    apiBaseUrl: "http://127.0.0.1:3040",
    publicDir: path.resolve(cwd, "apps/web/public")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === "--host") {
      options.host = requireValue(argv[index + 1], "--host");
      index += 1;
      continue;
    }

    if (token === "--port") {
      const value = requireValue(argv[index + 1], "--port");
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error(`Invalid --port value: ${value}`);
      }
      options.port = parsed;
      index += 1;
      continue;
    }

    if (token === "--api-base-url") {
      options.apiBaseUrl = requireValue(argv[index + 1], "--api-base-url");
      index += 1;
      continue;
    }

    if (token === "--public-dir") {
      options.publicDir = path.resolve(requireValue(argv[index + 1], "--public-dir"));
      index += 1;
      continue;
    }

    if (token === "--help" || token === "-h") {
      throw new Error(renderHelpText());
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function renderHelpText(): string {
  return [
    "Usage: node dist/apps/web/src/server.js [--host <host>] [--port <port>] [--api-base-url <url>] [--public-dir <path>]",
    "",
    "Options:",
    "  --host          Web host (default: 127.0.0.1)",
    "  --port          Web port (default: 3050)",
    "  --api-base-url  API base URL for /api/* proxy (default: http://127.0.0.1:3040)",
    "  --public-dir    Static directory (default: apps/web/public)"
  ].join("\n");
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

async function proxyApiRequest(request: IncomingMessage, response: ServerResponse, apiBaseUrl: string): Promise<void> {
  const requestPath = request.url?.replace(/^\/api/, "") ?? "/";
  const targetUrl = `${apiBaseUrl}${requestPath}`;
  const body = await readRequestBody(request);

  const headers: Record<string, string> = {};
  const contentType = request.headers["content-type"];
  if (typeof contentType === "string") {
    headers["content-type"] = contentType;
  }

  const upstream = await fetch(targetUrl, {
    method: request.method ?? "GET",
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : body ? new Uint8Array(body) : undefined
  });

  response.statusCode = upstream.status;
  const upstreamContentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";
  response.setHeader("content-type", upstreamContentType);

  const payload = Buffer.from(await upstream.arrayBuffer());
  response.end(payload);
}

async function serveStaticAsset(urlPath: string, response: ServerResponse, publicDir: string): Promise<void> {
  const parsedPath = new URL(`http://localhost${urlPath}`).pathname;
  const normalizedPath = parsedPath === "/" ? "/index.html" : parsedPath;
  const candidate = path.resolve(publicDir, `.${normalizedPath}`);

  if (!candidate.startsWith(publicDir)) {
    writeText(response, 403, "Forbidden");
    return;
  }

  let filePath = candidate;
  let contentType = guessContentType(filePath);

  try {
    const content = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("content-type", contentType);
    response.end(content);
    return;
  } catch {
    if (!normalizedPath.endsWith(".html")) {
      filePath = path.resolve(publicDir, "index.html");
      contentType = "text/html; charset=utf-8";
      const content = await readFile(filePath);
      response.statusCode = 200;
      response.setHeader("content-type", contentType);
      response.end(content);
      return;
    }
  }

  writeText(response, 404, "Not found");
}

function guessContentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return Buffer.concat(chunks);
}

function writeText(response: ServerResponse, statusCode: number, message: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end(message);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
