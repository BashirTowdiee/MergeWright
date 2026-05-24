import type { AppEvent } from "./app-event.js";

export type AppEventSubscriber = (event: AppEvent) => void | Promise<void>;

export type AppEventSubscription = {
  readonly unsubscribe: () => void;
};

export interface AppEventBus {
  publish(event: AppEvent): Promise<void>;
  subscribe(subscriber: AppEventSubscriber): AppEventSubscription;
}

export class InMemoryAppEventBus implements AppEventBus {
  private readonly subscribers = new Set<AppEventSubscriber>();

  async publish(event: AppEvent): Promise<void> {
    const subscribers = Array.from(this.subscribers);
    await Promise.all(subscribers.map((subscriber) => subscriber(event)));
  }

  subscribe(subscriber: AppEventSubscriber): AppEventSubscription {
    this.subscribers.add(subscriber);
    return {
      unsubscribe: () => {
        this.subscribers.delete(subscriber);
      }
    };
  }
}
