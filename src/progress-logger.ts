export interface ProgressLogger {
  info(message: string): void;
  verbose(message: string): void;
  phaseStart(phase: string, detail?: string): void;
  phaseComplete(phase: string, detail?: string): void;
  phaseSkipped(phase: string, reason: string): void;
  phaseFailed(phase: string, error: unknown): void;
  artefact(label: string, path: string): void;
  codexStreamStart(phase: string): void;
  codexStdout(chunk: string): void;
  codexStderr(chunk: string): void;
  codexStreamEnd(phase: string): void;
}

export const NOOP_PROGRESS_LOGGER: ProgressLogger = {
  info: () => {},
  verbose: () => {},
  phaseStart: () => {},
  phaseComplete: () => {},
  phaseSkipped: () => {},
  phaseFailed: () => {},
  artefact: () => {},
  codexStreamStart: () => {},
  codexStdout: () => {},
  codexStderr: () => {},
  codexStreamEnd: () => {}
};

export function createProgressLogger(
  writeLine: (line: string) => void,
  options: { verbose: boolean }
): ProgressLogger {
  const verboseEnabled = options.verbose;
  return {
    info(message: string): void {
      writeLine(message);
    },
    verbose(message: string): void {
      if (verboseEnabled) {
        writeLine(message);
      }
    },
    phaseStart(phase: string, detail?: string): void {
      writeLine(`[${phase}] ${detail ?? "starting"}`);
    },
    phaseComplete(phase: string, detail?: string): void {
      writeLine(`[${phase}] ${detail ? `${detail}` : "completed"}`);
    },
    phaseSkipped(phase: string, reason: string): void {
      writeLine(`[${phase}] ${reason}`);
    },
    phaseFailed(phase: string, error: unknown): void {
      const message = error instanceof Error ? error.message : String(error);
      writeLine(message ? `[${phase}] failed: ${message}` : `[${phase}] failed`);
    },
    artefact(label: string, filePath: string): void {
      writeLine(`[artefact] ${label}: ${filePath}`);
    },
    codexStreamStart(phase: string): void {
      writeLine(`[${phase}] Codex stream start`);
      writeLine("────────────────────────────────");
    },
    codexStdout(chunk: string): void {
      process.stdout.write(chunk);
    },
    codexStderr(chunk: string): void {
      process.stderr.write(chunk);
    },
    codexStreamEnd(phase: string): void {
      writeLine("────────────────────────────────");
      writeLine(`[${phase}] Codex stream end`);
    }
  };
}

export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const totalSeconds = durationMs / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
