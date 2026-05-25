import test from "node:test";
import assert from "node:assert/strict";
import type { TaskReadModel } from "../src/application/read-models/task-read-model.js";
import { InMemoryTaskReadRepository } from "../src/application/queries/in-memory-task-read-repository.js";
import { DefaultTaskQueryService } from "../src/application/queries/task-query-service.js";

const tasks: TaskReadModel[] = [
  {
    id: "task-1",
    title: "Extract run read models",
    role: "builder",
    status: "completed",
    priority: 1,
    filesInScope: ["src/application/read-models/run-read-model.ts"],
    acceptanceCriteria: ["Shared read models do not mention TUI"],
    dependsOn: []
  },
  {
    id: "task-2",
    title: "Add query service",
    role: "builder",
    status: "active",
    priority: 2,
    filesInScope: ["src/application/queries/run-query-service.ts"],
    acceptanceCriteria: ["Query service is framework-agnostic"],
    dependsOn: ["task-1"],
    selectedRunId: "run-1"
  },
  {
    id: "task-3",
    title: "Resolve CI failure",
    role: "resolver",
    status: "blocked",
    priority: 3,
    filesInScope: [],
    acceptanceCriteria: ["CI failure is understood"],
    dependsOn: ["task-2"],
    blockedReason: "Waiting for CI logs"
  }
];

function createService(): DefaultTaskQueryService {
  return new DefaultTaskQueryService(new InMemoryTaskReadRepository({ tasks }));
}

test("DefaultTaskQueryService lists tasks in repository order", async () => {
  const service = createService();

  const result = await service.listTasks();

  assert.deepEqual(result.map((task) => task.id), ["task-1", "task-2", "task-3"]);
});

test("DefaultTaskQueryService filters tasks by status", async () => {
  const service = createService();

  const result = await service.listTasks({ status: "active" });

  assert.deepEqual(result.map((task) => task.id), ["task-2"]);
});

test("DefaultTaskQueryService returns task detail by id", async () => {
  const service = createService();

  const task = await service.getTask({ taskId: "task-3" });

  assert.equal(task?.role, "resolver");
  assert.equal(task?.blockedReason, "Waiting for CI logs");
});

test("DefaultTaskQueryService handles blank and missing task ids", async () => {
  const service = createService();

  assert.equal(await service.getTask({ taskId: "" }), null);
  assert.equal(await service.getTask({ taskId: "missing-task" }), null);
});
