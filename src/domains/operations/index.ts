/** Operations owns restaurant activity. It can consume Product Contract and publish Sales Contract only. */
export {};
export { OperationsService } from "./application/operations-service.js";
export { OperationsRepository } from "./infrastructure/operations-repository.js";
export type { EventProduct, EventStatus, OperationsEvent, SellableInventory } from "./domain/types.js";
