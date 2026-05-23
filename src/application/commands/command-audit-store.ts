import type { CommandAuditRecord } from "./command-audit-record.js";

export type AppendCommandAuditRecordRequest = {
  readonly record: CommandAuditRecord;
};

export interface CommandAuditStore {
  append(request: AppendCommandAuditRecordRequest): Promise<void>;
}
