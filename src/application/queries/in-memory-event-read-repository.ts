import type { AppEvent } from "../events/app-event.js";
import type { EventReadRepository } from "./event-query-service.js";

export interface InMemoryEventReadRepositoryInput {
  events: AppEvent[];
}

export class InMemoryEventReadRepository implements EventReadRepository {
  private readonly events: AppEvent[];

  constructor(input: InMemoryEventReadRepositoryInput = { events: [] }) {
    this.events = [...input.events];
  }

  async listEvents(): Promise<AppEvent[]> {
    return [...this.events];
  }
}
