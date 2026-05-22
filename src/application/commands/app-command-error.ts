export type AppCommandErrorCode =
  | "VALIDATION_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "WRITE_SAFETY_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXECUTION_FAILED";

export type AppCommandError = {
  readonly code: AppCommandErrorCode;
  readonly reason: string;
  readonly details?: unknown;
};

export const APP_COMMAND_ERROR_CODES: readonly AppCommandErrorCode[] = [
  "VALIDATION_FAILED",
  "CONFIRMATION_REQUIRED",
  "WRITE_SAFETY_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "EXECUTION_FAILED"
];
