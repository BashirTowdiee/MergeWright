import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AuditedFlowAuditEventView } from "../read-models/audited-flow-read-model.js";
import type { RunQueryService } from "./run-query-service.js";

export interface AuditedFlowAuditQueryService {
  listEvents(input: { runId: string }): Promise<AuditedFlowAuditEventView[]>;
}

export class DefaultAuditedFlowAuditQueryService implements AuditedFlowAuditQueryService {
  constructor(private readonly runQueryService: RunQueryService) {}

  async listEvents(input: { runId: string }): Promise<AuditedFlowAuditEventView[]> {
    if (!input.runId.trim()) {
      return [];
    }

    const run = await this.runQueryService.getRun({ runId: input.runId });
    if (!run) {
      return [];
    }

    const auditPath = path.join(run.runDir, "audit.ndjson");
    let raw: string;
    try {
      raw = await readFile(auditPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const events: AuditedFlowAuditEventView[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const parsed = JSON.parse(trimmed) as AuditedFlowAuditEventView;
      events.push(parsed);
    }
    return events;
  }
}
