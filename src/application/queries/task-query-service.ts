import type { TaskReadModel, TaskStatus } from "../read-models/task-read-model.js";

export interface ListTasksInput {
  status?: TaskStatus | "all";
}

export interface GetTaskInput {
  taskId: string;
}

export interface TaskReadRepository {
  listTasks(): Promise<TaskReadModel[]>;
  getTask(taskId: string): Promise<TaskReadModel | null>;
}

export interface TaskQueryService {
  listTasks(input?: ListTasksInput): Promise<TaskReadModel[]>;
  getTask(input: GetTaskInput): Promise<TaskReadModel | null>;
}

export class DefaultTaskQueryService implements TaskQueryService {
  constructor(private readonly repository: TaskReadRepository) {}

  async listTasks(input: ListTasksInput = {}): Promise<TaskReadModel[]> {
    const tasks = await this.repository.listTasks();
    const status = input.status ?? "all";
    if (status === "all") {
      return tasks;
    }
    return tasks.filter((task) => task.status === status);
  }

  async getTask(input: GetTaskInput): Promise<TaskReadModel | null> {
    if (!input.taskId.trim()) {
      return null;
    }
    return this.repository.getTask(input.taskId);
  }
}
