export class StageExecutionError extends Error {
  readonly executionStarted: boolean;

  constructor(message: string, executionStarted: boolean, cause?: unknown) {
    super(message);
    this.name = "StageExecutionError";
    this.executionStarted = executionStarted;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function asStageExecutionError(error: unknown, executionStarted: boolean): StageExecutionError {
  if (error instanceof StageExecutionError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new StageExecutionError(message, executionStarted, error);
}
