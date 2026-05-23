import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppendCommandAuditRecordRequest, CommandAuditStore } from "./command-audit-store.js";

export type FilesystemCommandAuditStoreOptions = {
  readonly auditDirectory: string;
};

export class FilesystemCommandAuditStore implements CommandAuditStore {
  private readonly auditDirectory: string;

  constructor(options: FilesystemCommandAuditStoreOptions) {
    this.auditDirectory = options.auditDirectory;
  }

  async append(request: AppendCommandAuditRecordRequest): Promise<void> {
    await mkdir(this.auditDirectory, { recursive: true });
    const recordPath = path.join(this.auditDirectory, `${toAuditRecordFilename(request.record.id)}.json`);

    await writeFile(recordPath, `${JSON.stringify(request.record, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
  }
}

export function toAuditRecordFilename(id: string): string {
  const filename = id.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return filename || "audit-record";
}
