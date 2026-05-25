import type { TaskReadModel } from "../read-models/task-read-model.js";
import type { TaskReadRepository } from "./task-query-service.js";

export interface InMemoryTaskReadRepositoryInput {
  tasks: TaskReadModel[];
}

export class InMemoryTaskReadRepository implements TaskReadRepository {
  private readonly tasks: TaskReadModel[];
  private readonly tasksById: Record<string, TaskReadModel>;

  constructor(input: InMemoryTaskReadRepositoryInput = { tasks: [] }) {
    this.tasks = [...input.tasks];
    this.tasksById = Object.fromEntries(this.tasks.map((task) => [task.id, task]));
  }

  async listTasks(): Promise<TaskReadModel[]> {
    return [...this.tasks];
  }

  async getTask(taskId: string): Promise<TaskReadModel | null> {
    return this.tasksById[taskId] ?? null;
  }
}
