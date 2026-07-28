import {
  InvalidRecipeEvent,
  RecipeEventAlreadyConsumed
} from "./errors.js";
import type { RecipeDomainEvent } from "./recipe-domain-events.js";

const EMPTY_EVENTS: readonly RecipeDomainEvent[] = Object.freeze([]);

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((nested) => isDeeplyFrozen(nested, seen));
}

/**
 * peek() is an idempotent read until drain(). drain() succeeds exactly once.
 * After drain, peek() returns an empty collection and another drain is rejected.
 */
export class RecipeEventCollection {
  private drained = false;
  private readonly events: readonly RecipeDomainEvent[];

  private constructor(events: readonly RecipeDomainEvent[]) {
    const eventIds = new Set<string>();
    for (const event of events) {
      if (eventIds.has(event.eventId)) {
        throw new InvalidRecipeEvent(`Duplicate Recipe eventId ${event.eventId}.`);
      }
      if (!isDeeplyFrozen(event)) {
        throw new InvalidRecipeEvent("Recipe Domain Event must be deeply immutable.");
      }
      eventIds.add(event.eventId);
    }
    this.events = Object.freeze([...events]);
  }

  static create(events: readonly RecipeDomainEvent[]): RecipeEventCollection {
    return new RecipeEventCollection(events);
  }

  get hasBeenDrained(): boolean {
    return this.drained;
  }

  peek(): readonly RecipeDomainEvent[] {
    return this.drained ? EMPTY_EVENTS : this.events;
  }

  drain(): readonly RecipeDomainEvent[] {
    if (this.drained) {
      throw new RecipeEventAlreadyConsumed();
    }
    this.drained = true;
    return this.events;
  }
}
