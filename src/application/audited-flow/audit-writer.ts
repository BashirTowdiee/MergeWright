import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AuditedFlowAuditEvent } from "./audit-events.js";
import { redactAuditMetadata } from "./audit-redaction.js";

export interface AuditedFlowAuditWriter {
  readonly auditPath: string;
  append(event: AuditedFlowAuditEvent): Promise<void>;
}

export class FilesystemAuditedFlowAuditWriter implements AuditedFlowAuditWriter {
  readonly auditPath: string;

  constructor(auditPath: string) {
    this.auditPath = auditPath;
  }

  async append(event: AuditedFlowAuditEvent): Promise<void> {
    await mkdir(path.dirname(this.auditPath), { recursive: true });
    const line = JSON.stringify(redactAuditMetadata(event));
    await appendFile(this.auditPath, `${line}\n`, "utf8");
  }
}
