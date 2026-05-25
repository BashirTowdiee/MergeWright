export type RunStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "cancelled" | "unknown";

export type RunPhaseStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "skipped" | "unknown";

export type RunMode = "dry-run" | "read-only" | "write-enabled" | "auto-chain" | "unknown";

export type RunArtefactKind = "markdown" | "json" | "log" | "diff" | "text";
