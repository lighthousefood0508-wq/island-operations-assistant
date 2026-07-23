import { parseProductContract, type ProductContractV2 } from "../../../shared/contracts/product-contract.js";
import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import { EVENT_STATUSES, type EventProduct, type EventStatus, type OperationsEvent, type SellableInventory, type SellableInventoryView } from "../domain/types.js";
import { OperationsRepository } from "../infrastructure/operations-repository.js";

export type CreateEventInput = Readonly<{ eventCode?: string; displayName: string; date: string; startTime: string; endTime: string }>;
export type UpdateEventInput = Readonly<Partial<CreateEventInput>>;
export type SetSellableInventoryInput = Readonly<{ plannedQuantity: number; safetyBufferQuantity?: number }>;
export type InventoryBatchItemInput = Readonly<{ productVersionId: string; plannedQuantity: number; safetyBufferQuantity?: number; isEnabled?: boolean }>;
export type SaveInventoryBatchInput = Readonly<{ idempotencyKey: string; operator?: string; items: readonly InventoryBatchItemInput[] }>;

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
function optionalEventCode(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, "eventCode");
}
function enabled(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw new HttpError(422, "validation_error", "isEnabled must be a boolean.", { field: "isEnabled" });
  return value;
}
function idempotencyKey(value: unknown): string {
  const key = requiredText(value, "idempotencyKey");
  if (key.length > 200) throw new HttpError(422, "validation_error", "idempotencyKey is too long.", { field: "idempotencyKey" });
  return key;
}

export class OperationsService {
  constructor(private readonly repository: OperationsRepository) {}
  listEvents(): OperationsEvent[] { return this.repository.listEvents(); }
  getCurrentEvent(): OperationsEvent | null { return this.repository.findOperationalEvent() ?? null; }
  getCurrentProducts(): EventProduct[] { const event = this.getCurrentEvent(); return event ? this.repository.listCurrentProducts(event.eventId) : []; }
  getInventory(eventId: string): SellableInventoryView[] { this.requireEvent(eventId); return this.repository.listInventory(eventId); }

  createEvent(input: CreateEventInput): OperationsEvent {
    const timestamp = now();
    const eventDate = date(input.date);
    const suppliedEventCode = optionalEventCode(input.eventCode);
    return this.repository.transactionImmediate(() => {
      const eventCode = suppliedEventCode ?? this.generateEventCode(eventDate);
      const existing = this.repository.findEventByCode(eventCode);
      if (existing) throw new HttpError(409, "event_code_conflict", "Event code already exists.", { eventCode });
      const event: OperationsEvent = { eventId: createId("event_"), eventCode, displayName: requiredText(input.displayName, "displayName"), date: eventDate, startTime: time(input.startTime, "startTime"), endTime: time(input.endTime, "endTime"), status: "draft", createdAt: timestamp, updatedAt: timestamp };
      this.repository.insertEvent(event);
      return event;
    });
  }
  updateEvent(eventId: string, input: UpdateEventInput): OperationsEvent {
    const current = this.requireEvent(eventId);
    if (current.status === "archived") throw new HttpError(422, "event_archived", "An archived event cannot be changed.");
    const eventDate = input.date === undefined ? current.date : date(input.date);
    const suppliedEventCode = optionalEventCode(input.eventCode);
    return this.repository.transactionImmediate(() => {
      const eventCode = suppliedEventCode ?? (eventDate === current.date ? current.eventCode : this.generateEventCode(eventDate));
      const existing = this.repository.findEventByCode(eventCode);
      if (existing && existing.eventId !== eventId) throw new HttpError(409, "event_code_conflict", "Event code already exists.", { eventCode });
      const event: OperationsEvent = { ...current, eventCode, displayName: input.displayName === undefined ? current.displayName : requiredText(input.displayName, "displayName"), date: eventDate, startTime: input.startTime === undefined ? current.startTime : time(input.startTime, "startTime"), endTime: input.endTime === undefined ? current.endTime : time(input.endTime, "endTime"), updatedAt: now() };
      this.repository.updateEvent(event);
      return event;
    });
  }
  setSellableInventory(eventId: string, contractInput: unknown, input: SetSellableInventoryInput): SellableInventoryView {
    const event = this.requireEvent(eventId);
    if (event.status !== "draft") throw new HttpError(422, "event_not_draft", "Sellable inventory can only be changed while an event is draft.");
    const contract = parseProductContract(contractInput);
    if (!contract.isActive) throw new HttpError(422, "product_inactive", "Only active published products can be made sellable.");
    const timestamp = now();
    const plannedQuantity = quantity(input.plannedQuantity);
    const safetyBufferQuantity = safetyBuffer(input.safetyBufferQuantity, plannedQuantity);
    const inventory: SellableInventory = { eventId, productId: contract.productId, productVersionId: contract.productVersionId, plannedQuantity, reservedQuantity: 0, soldQuantity: 0, safetyBufferQuantity, isEnabled: true, remainingQuantity: plannedQuantity, customerAvailableQuantity: Math.max(0, plannedQuantity - safetyBufferQuantity), createdAt: timestamp, updatedAt: timestamp };
    this.repository.transaction(() => { this.repository.upsertProductCopy(contract, timestamp); this.repository.setInventory(inventory); });
    return this.repository.listInventory(eventId).find((item) => item.productVersionId === contract.productVersionId) as SellableInventoryView;
  }
  openEvent(eventId: string): OperationsEvent { return this.transition(eventId, "draft", "open", () => { if (!this.repository.hasPositiveInventory(eventId)) throw new HttpError(422, "sellable_inventory_required", "Add at least one sellable product before opening the event."); }); }
  pauseEvent(eventId: string): OperationsEvent { return this.transition(eventId, "open", "paused"); }
  resumeEvent(eventId: string): OperationsEvent { return this.transition(eventId, "paused", "open"); }
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
  saveInventoryBatch(eventId: string, contractsByVersionId: ReadonlyMap<string, unknown>, input: SaveInventoryBatchInput): Readonly<{ inventory: readonly SellableInventoryView[]; replayed: boolean }> {
    const event = this.requireEvent(eventId);
    if (event.status !== "draft" && event.status !== "paused") throw new HttpError(422, "event_inventory_locked", "Inventory can only be changed while an event is draft or paused.");
    const key = idempotencyKey(input.idempotencyKey);
    if (!Array.isArray(input.items) || input.items.length === 0) throw new HttpError(422, "validation_error", "items must contain at least one inventory item.", { field: "items" });
    const normalized = input.items.map((item) => ({ productVersionId: requiredText(item.productVersionId, "productVersionId"), plannedQuantity: quantity(item.plannedQuantity), safetyBufferQuantity: safetyBuffer(item.safetyBufferQuantity, quantity(item.plannedQuantity)), isEnabled: enabled(item.isEnabled) }));
    const seen = new Set<string>();
    for (const item of normalized) {
      if (seen.has(item.productVersionId)) throw new HttpError(422, "validation_error", "Each productVersionId may only appear once.", { field: "items" });
      seen.add(item.productVersionId);
    }
    const fingerprint = JSON.stringify([...normalized].sort((a, b) => a.productVersionId.localeCompare(b.productVersionId)));
    const timestamp = now();
    const operator = typeof input.operator === "string" && input.operator.trim() ? input.operator.trim().slice(0, 100) : "Owner";
    return this.repository.transactionImmediate(() => {
      const previous = this.repository.findInventoryAdjustmentBatch(eventId, key);
      if (previous) {
        if (previous.requestFingerprint !== fingerprint) throw new HttpError(409, "idempotency_conflict", "This inventory save key was already used with a different request.");
        return { inventory: this.repository.listInventory(eventId), replayed: true };
      }
      const existingByVersion = new Map(this.repository.listInventory(eventId).map((item) => [item.productVersionId, item]));
      const batchId = createId("invbatch_");
      const auditLogId = createId("audit_");
      this.repository.insertInventoryAdjustmentBatch({ batchId, eventId, idempotencyKey: key, requestFingerprint: fingerprint, operator, createdAt: timestamp, auditLogId });
      for (const item of normalized) {
        const existing = existingByVersion.get(item.productVersionId);
        let inventory: SellableInventory;
        if (existing) {
          const committedQuantity = existing.reservedQuantity + existing.soldQuantity;
          if (item.plannedQuantity < committedQuantity) throw new HttpError(422, "planned_quantity_below_committed", "Planned quantity cannot be below the already reserved and sold quantity.", { productVersionId: item.productVersionId, committedQuantity: String(committedQuantity) });
          inventory = { ...existing, plannedQuantity: item.plannedQuantity, safetyBufferQuantity: item.safetyBufferQuantity, isEnabled: item.isEnabled, remainingQuantity: item.plannedQuantity - existing.reservedQuantity - existing.soldQuantity, customerAvailableQuantity: Math.max(0, item.plannedQuantity - existing.reservedQuantity - existing.soldQuantity - item.safetyBufferQuantity), updatedAt: timestamp };
        } else {
          const contract = parseProductContract(contractsByVersionId.get(item.productVersionId));
          if (!contract.isActive) throw new HttpError(422, "product_inactive", "Only active published products can be added to an event.");
          this.repository.upsertProductCopy(contract, timestamp);
          inventory = { eventId, productId: contract.productId, productVersionId: contract.productVersionId, plannedQuantity: item.plannedQuantity, reservedQuantity: 0, soldQuantity: 0, safetyBufferQuantity: item.safetyBufferQuantity, isEnabled: item.isEnabled, remainingQuantity: item.plannedQuantity, customerAvailableQuantity: Math.max(0, item.plannedQuantity - item.safetyBufferQuantity), createdAt: timestamp, updatedAt: timestamp };
        }
        this.repository.setInventory(inventory);
        this.repository.insertInventoryAdjustment({ adjustmentId: createId("invadj_"), batchId, eventId, productId: inventory.productId, productVersionId: inventory.productVersionId, plannedBefore: existing?.plannedQuantity ?? 0, plannedAfter: inventory.plannedQuantity, safetyBefore: existing?.safetyBufferQuantity ?? 0, safetyAfter: inventory.safetyBufferQuantity, enabledBefore: existing?.isEnabled ?? false, enabledAfter: inventory.isEnabled, createdAt: timestamp });
      }
      this.repository.insertAudit({ auditLogId, eventId, action: "inventory_batch_saved", metadata: { operator, eventId, itemCount: normalized.length }, occurredAt: timestamp });
      return { inventory: this.repository.listInventory(eventId), replayed: false };
    });
  }
  private generateEventCode(eventDate: string): string {
    const prefix = eventDate.replaceAll("-", "");
    const used = new Set<number>();
    for (const code of this.repository.listEventCodesByDate(eventDate)) {
      const match = new RegExp(`^${prefix}-(\\d{2})$`).exec(code);
      if (match?.[1]) used.add(Number(match[1]));
    }
    for (let sequence = 1; sequence <= 99; sequence += 1) {
      if (!used.has(sequence)) return `${prefix}-${String(sequence).padStart(2, "0")}`;
    }
    throw new HttpError(409, "event_code_exhausted", `No event code is available for ${eventDate}.`);
  }
}
