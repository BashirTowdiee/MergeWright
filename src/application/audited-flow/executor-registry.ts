import type { StageExecutor } from "./stage-executor.js";

export class StageExecutorRegistry {
  private readonly executors = new Map<string, StageExecutor>();

  constructor(executors: readonly StageExecutor[]) {
    for (const executor of executors) {
      if (this.executors.has(executor.id)) {
        throw new Error(`Duplicate stage executor id: ${executor.id}`);
      }
      this.executors.set(executor.id, executor);
    }
  }

  has(id: string): boolean {
    return this.executors.has(id);
  }

  resolve(id: string): StageExecutor {
    const executor = this.executors.get(id);
    if (!executor) {
      throw new Error(`Unknown stage executor: ${id}`);
    }
    return executor;
  }
}
