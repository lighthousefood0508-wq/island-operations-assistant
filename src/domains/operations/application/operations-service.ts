import { parseProductContract, type ProductContractV2 } from "../../../shared/contracts/product-contract.js";
import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import { EVENT_STATUSES, type EventProduct, type EventStatus, type OperationsEvent, type SellableInventory, type SellableInventoryView } from "../domain/types.js";
import { OperationsRepository } from "../infrastructure/operations-repository.js";

export type CreateEventInput = Readonly<{ eventCode: string; displayName: string; date: string; startTime: string; endTime: string }>;
export type UpdateEventInput = Readonly<Partial<CreateEventInput>>;
export type SetSellableInventoryInput = Readonly<{ plannedQuantity: number; safetyBufferQuantity?: number }>;

function now(): string { return new Date().toISOString(); }
function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new HttpError(422, "validation_error", `${field} is required.`, { field });
  return value.trim();
}
function date(value: unknown): string {
  const text = requiredText(value, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new HttpError(422, "validation_error", "date must use YYYY-MM-DD.", { field: "date" });
  return text;
}
function time(value: unknown, field: string): string {
  const text = requiredText(value, field);
  if (!/^\d{2}:\d{2}$/.test(text)) throw new HttpError(422, "validation_error", `${field} must use HH:MM.`, { field });
  return text;
}
function quantity(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new HttpError(422, "validation_error", "plannedQuantity must be a non-negative integer.", { field: "plannedQuantity" });
  return value as number;
}
function safetyBuffer(value: unknown, plannedQuantity: number): number {
  const quantityValue = value === undefined ? 0 : value;
  if (!Number.isSafeInteger(quantityValue) || (quantityValue as number) < 0) throw new HttpError(422, "validation_error", "safetyBufferQuantity must be a non-negative integer.", { field: "safetyBufferQuantity" });
  if ((quantityValue as number) > plannedQuantity) throw new HttpError(422, "validation_error", "safetyBufferQuantity cannot exceed plannedQuantity.", { field: "safetyBufferQuantity" });
  return quantityValue as number;
}

export class OperationsService {
  constructor(private readonly repository: OperationsRepository) {}
  listEvents(): OperationsEvent[] { return this.repository.listEvents(); }
  getCurrentEvent(): OperationsEvent | null { return this.repository.findOpenEvent() ?? null; }
  getCurrentProducts(): EventProduct[] { const event = this.getCurrentEvent(); return event ? this.repository.listCurrentProducts(event.eventId) : []; }
  getInventory(eventId: string): SellableInventoryView[] { this.requireEvent(eventId); return this.repository.listInventory(eventId); }

  createEvent(input: CreateEventInput): OperationsEvent {
    const timestamp = now();
    const event: OperationsEvent = { eventId: createId("event_"), eventCode: requiredText(input.eventCode, "eventCode"), displayName: requiredText(input.displayName, "displayName"), date: date(input.date), startTime: time(input.startTime, "startTime"), endTime: time(input.endTime, "endTime"), status: "draft", createdAt: timestamp, updatedAt: timestamp };
    this.repository.transaction(() => this.repository.insertEvent(event));
    return event;
  }
  updateEvent(eventId: string, input: UpdateEventInput): OperationsEvent {
    const current = this.requireEvent(eventId);
    if (current.status === "archived") throw new HttpError(422, "event_archived", "An archived event cannot be changed.");
    const event: OperationsEvent = { ...current, eventCode: input.eventCode === undefined ? current.eventCode : requiredText(input.eventCode, "eventCode"), displayName: input.displayName === undefined ? current.displayName : requiredText(input.displayName, "displayName"), date: input.date === undefined ? current.date : date(input.date), startTime: input.startTime === undefined ? current.startTime : time(input.startTime, "startTime"), endTime: input.endTime === undefined ? current.endTime : time(input.endTime, "endTime"), updatedAt: now() };
    this.repository.transaction(() => this.repository.updateEvent(event));
    return event;
  }
  setSellableInventory(eventId: string, contractInput: unknown, input: SetSellableInventoryInput): SellableInventoryView {
    const event = this.requireEvent(eventId);
    if (event.status !== "draft") throw new HttpError(422, "event_not_draft", "Sellable inventory can only be changed while an event is draft.");
    const contract = parseProductContract(contractInput);
    if (!contract.isActive) throw new HttpError(422, "product_inactive", "Only active published products can be made sellable.");
    const timestamp = now();
    const plannedQuantity = quantity(input.plannedQuantity);
    const safetyBufferQuantity = safetyBuffer(input.safetyBufferQuantity, plannedQuantity);
    const inventory: SellableInventory = { eventId, productId: contract.productId, productVersionId: contract.productVersionId, plannedQuantity, reservedQuantity: 0, soldQuantity: 0, safetyBufferQuantity, remainingQuantity: plannedQuantity, customerAvailableQuantity: Math.max(0, plannedQuantity - safetyBufferQuantity), createdAt: timestamp, updatedAt: timestamp };
    this.repository.transaction(() => { this.repository.upsertProductCopy(contract, timestamp); this.repository.setInventory(inventory); });
    return this.repository.listInventory(eventId).find((item) => item.productVersionId === contract.productVersionId) as SellableInventoryView;
  }
  openEvent(eventId: string): OperationsEvent { return this.transition(eventId, "draft", "open", () => { if (!this.repository.hasPositiveInventory(eventId)) throw new HttpError(422, "sellable_inventory_required", "Add at least one sellable product before opening the event."); }); }
  closeEvent(eventId: string): OperationsEvent { return this.transition(eventId, "open", "closed"); }
  archiveEvent(eventId: string): OperationsEvent {
    const current = this.requireEvent(eventId);
    if (current.status !== "draft" && current.status !== "closed") throw new HttpError(422, "invalid_event_transition", "Only draft or closed events can be archived.");
    const event: OperationsEvent = { ...current, status: "archived", updatedAt: now() };
    this.repository.transaction(() => this.repository.updateEvent(event));
    return event;
  }
  private transition(eventId: string, from: EventStatus, to: EventStatus, before?: () => void): OperationsEvent {
    const current = this.requireEvent(eventId);
    if (current.status !== from) throw new HttpError(422, "invalid_event_transition", `Event must be ${from} before it can become ${to}.`);
    before?.();
    const event: OperationsEvent = { ...current, status: to, updatedAt: now() };
    try { this.repository.transaction(() => this.repository.updateEvent(event)); }
    catch (error) { if (to === "open") throw new HttpError(409, "open_event_exists", "Only one event can be open at a time."); throw error; }
    return event;
  }
  private requireEvent(eventId: string): OperationsEvent {
    const event = this.repository.findEvent(eventId);
    if (!event) throw new HttpError(404, "event_not_found", "Event was not found.");
    return event;
  }
}
