import { createHash } from "node:crypto";
import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import type { CreatePosOrderInput, OperationsOrder, PosOrderItemInput } from "../domain/types.js";
import { OrderRepository, type OrderProductSnapshot } from "../infrastructure/order-repository.js";

type CreateOrderResult = Readonly<{ order: OperationsOrder; replayed: boolean }>;

function now(): string { return new Date().toISOString(); }
function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, "VALIDATION_ERROR", `${field} must be a string or null.`, { field });
  const text = value.trim();
  return text === "" ? null : text;
}
function requiredText(value: unknown, field: string): string {
  const text = optionalText(value, field);
  if (!text) throw new HttpError(400, "VALIDATION_ERROR", `${field} is required.`, { field });
  return text;
}
function parseItem(value: unknown): PosOrderItemInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "VALIDATION_ERROR", "items must contain objects.", { field: "items" });
  const record = value as Record<string, unknown>;
  const quantity = record.quantity;
  if (!Number.isSafeInteger(quantity) || (quantity as number) <= 0) throw new HttpError(400, "INVALID_QUANTITY", "quantity must be a positive integer.", { field: "quantity" });
  return { productId: requiredText(record.productId, "productId"), productVersionId: requiredText(record.productVersionId, "productVersionId"), quantity: quantity as number, notes: optionalText(record.notes, "notes") };
}

function parseInput(value: unknown): CreatePosOrderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "VALIDATION_ERROR", "Request body must be an object.");
  const record = value as Record<string, unknown>;
  if (record.source !== "pos") throw new HttpError(400, "UNSUPPORTED_ORDER_SOURCE", "Only source=pos is implemented in Phase 1C.", { field: "source" });
  if (!Array.isArray(record.items) || record.items.length === 0) throw new HttpError(400, "VALIDATION_ERROR", "items must not be empty.", { field: "items" });
  const idempotencyKey = requiredText(record.idempotencyKey, "idempotencyKey");
  if (idempotencyKey.length > 200) throw new HttpError(400, "VALIDATION_ERROR", "idempotencyKey is too long.", { field: "idempotencyKey" });
  return { source: "pos", eventId: requiredText(record.eventId, "eventId"), idempotencyKey, items: record.items.map(parseItem), customerName: optionalText(record.customerName, "customerName"), notes: optionalText(record.notes, "notes") };
}

function normalizeItems(items: readonly PosOrderItemInput[]): PosOrderItemInput[] {
  const merged = new Map<string, PosOrderItemInput>();
  for (const item of items) {
    const key = `${item.productId}\u0000${item.productVersionId}\u0000${item.notes ?? ""}`;
    const current = merged.get(key);
    merged.set(key, current ? { ...current, quantity: current.quantity + item.quantity } : item);
  }
  return [...merged.values()].sort((left, right) => `${left.productId}\u0000${left.productVersionId}\u0000${left.notes ?? ""}`.localeCompare(`${right.productId}\u0000${right.productVersionId}\u0000${right.notes ?? ""}`));
}

function fingerprint(input: CreatePosOrderInput, items: readonly PosOrderItemInput[]): string {
  return createHash("sha256").update(JSON.stringify({ source: input.source, eventId: input.eventId, items, customerName: input.customerName, notes: input.notes })).digest("hex");
}

function requirePosChannel(snapshot: OrderProductSnapshot): void {
  // The row stays entirely inside Operations; the JSON is the frozen Event Product Contract snapshot.
  void snapshot;
}

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  createPosOrder(payload: unknown): CreateOrderResult {
    const input = parseInput(payload);
    const items = normalizeItems(input.items);
    const requestFingerprint = fingerprint(input, items);
    const timestamp = now();
    return this.repository.transactionImmediate(() => {
      const existing = this.repository.findIdempotency(input.eventId, input.source, input.idempotencyKey);
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "The idempotency key was already used with a different request.");
        const order = this.repository.getOrder(existing.order_id);
        if (!order) throw new Error("Idempotency record references a missing order.");
        return { order, replayed: true };
      }

      const event = this.repository.findEvent(input.eventId);
      if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found.");
      if (event.status !== "open") throw new HttpError(409, "EVENT_NOT_OPEN", "Orders can only be created for an OPEN event.");

      const resolved = items.map((item) => {
        const product = this.repository.findProduct(input.eventId, item.productId);
        if (!product) throw new HttpError(404, "PRODUCT_NOT_IN_EVENT", "Product is not sellable in this event.");
        if (product.product_version_id !== item.productVersionId) throw new HttpError(409, "PRODUCT_VERSION_MISMATCH", "Product version does not match the Event snapshot.");
        if (product.is_active !== 1 || !(JSON.parse(product.channels_json) as unknown[]).includes("pos")) throw new HttpError(409, "CHANNEL_NOT_ENABLED", "Product is not enabled for POS in this Event snapshot.");
        const snapshot = this.repository.getProductSnapshot(input.eventId, item);
        if (!snapshot) throw new HttpError(409, "PRODUCT_VERSION_MISMATCH", "Product version does not match the Event snapshot.");
        requirePosChannel(snapshot);
        return { item, snapshot };
      });

      for (const { item } of resolved) {
        if (!this.repository.decrementRemaining(input.eventId, item, timestamp)) throw new HttpError(409, "INSUFFICIENT_QUANTITY", "Insufficient remaining quantity for this Event product.");
      }
      const orderId = createId("order_");
      const orderNumber = `${event.event_code}-${String(this.repository.nextOrderSequence(input.eventId, timestamp)).padStart(3, "0")}`;
      const subtotal = resolved.reduce((total, entry) => total + entry.snapshot.sellingPrice * entry.item.quantity, 0);
      this.repository.insertOrder({ orderId, eventId: input.eventId, orderNumber, idempotencyKey: input.idempotencyKey, fingerprint: requestFingerprint, customerName: input.customerName, notes: input.notes, subtotal, createdAt: timestamp });
      for (const { item, snapshot } of resolved) this.repository.insertOrderItem({ orderItemId: createId("order_item_"), orderId, item, snapshot, createdAt: timestamp });
      this.repository.insertIdempotency(input.eventId, input.idempotencyKey, requestFingerprint, orderId, timestamp);
      this.repository.insertAudit(orderId, input.eventId, orderNumber, resolved.reduce((total, entry) => total + entry.item.quantity, 0), subtotal, timestamp);
      const order = this.repository.getOrder(orderId);
      if (!order) throw new Error("Created order could not be loaded.");
      return { order, replayed: false };
    });
  }

  getOrder(orderId: string): OperationsOrder {
    const order = this.repository.getOrder(orderId);
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    return order;
  }
}
