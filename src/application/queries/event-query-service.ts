import type { AppEvent, AppEventType } from "../events/app-event.js";

export interface ListEventsInput {
  runId?: string;
  type?: AppEventType;
  afterEventId?: string;
  limit?: number;
}

export interface EventReadRepository {
  listEvents(): Promise<AppEvent[]>;
}

export interface EventQueryService {
  listEvents(input?: ListEventsInput): Promise<AppEvent[]>;
}

export class DefaultEventQueryService implements EventQueryService {
  constructor(private readonly repository: EventReadRepository) {}

  async listEvents(input: ListEventsInput = {}): Promise<AppEvent[]> {
    const events = await this.repository.listEvents();
    const afterIndex = input.afterEventId ? events.findIndex((event) => event.eventId === input.afterEventId) : -1;
    const cursorFiltered = afterIndex >= 0 ? events.slice(afterIndex + 1) : events;
    const filtered = cursorFiltered.filter((event) => {
      if (input.runId && event.runId !== input.runId) {
        return false;
      }
      if (input.type && event.type !== input.type) {
        return false;
      }
      return true;
    });

    if (input.limit === undefined) {
      return filtered;
    }

    const safeLimit = Math.max(0, input.limit);
    return filtered.slice(0, safeLimit);
  }
}
