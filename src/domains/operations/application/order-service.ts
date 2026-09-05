import { createHash } from "node:crypto";
import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import type { CreatePosOrderInput, OperationsOrder, PaymentMethod, PosOrderItemInput } from "../domain/types.js";
import { OrderRepository, type OrderProductSnapshot } from "../infrastructure/order-repository.js";
import { PaymentRepository } from "../infrastructure/payment-repository.js";

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
function optionalPhoneTail(value: unknown): string | null {
  const text = optionalText(value, "customerPhoneTail");
  if (text === null) return null;
  if (!/^\d{3}$/.test(text)) throw new HttpError(400, "VALIDATION_ERROR", "customerPhoneTail must be exactly 3 digits.", { field: "customerPhoneTail" });
  return text;
}
function optionalPaymentMethod(value: unknown): PaymentMethod | null {
  const text = optionalText(value, "paymentMethod");
  if (text === null) return null;
  if (text !== "CASH" && text !== "LINE_PAY") throw new HttpError(400, "VALIDATION_ERROR", "paymentMethod must be CASH or LINE_PAY.", { field: "paymentMethod" });
  return text;
}
function optionalCollected(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new HttpError(400, "VALIDATION_ERROR", "paymentCollected must be a boolean.", { field: "paymentCollected" });
  return value;
}
function clientText(value: unknown, field: string, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  const text = requiredText(value, field);
  if (text.length > 100) throw new HttpError(400, "VALIDATION_ERROR", `${field} is too long.`, { field });
  return text;
}
function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
// ScheduledPickupOrderLifecycleBoundary: Operations validates the complete instant.
function scheduledPickupAt(value: unknown, event: Readonly<{ date: string; start_time: string; end_time: string }>): string | null {
  const instant = optionalText(value, "scheduledPickupAt");
  if (instant === null) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d):[0-5]\d(?:\.\d{1,3})?\+08:00$/.exec(instant);
  if (!match?.[1] || !match[2]) throw new HttpError(400, "SCHEDULED_PICKUP_INVALID", "scheduledPickupAt must be an offset-bearing Event-local ISO instant.", { field: "scheduledPickupAt" });
  const [date, pickupTime] = [match[1], match[2]];
  const starts = event.start_time;
  const ends = event.end_time;
  const overnight = starts > ends;
  const valid = overnight ? pickupTime >= starts || pickupTime <= ends : pickupTime >= starts && pickupTime <= ends;
  const expectedDate = overnight && pickupTime <= ends ? nextDate(event.date) : event.date;
  if (!valid || date !== expectedDate) throw new HttpError(400, "SCHEDULED_PICKUP_OUTSIDE_EVENT", "scheduledPickupAt must be within the Event operating time.", { field: "scheduledPickupAt" });
  return instant;
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
  if (record.pickupTime !== undefined) throw new HttpError(400, "SCHEDULED_PICKUP_INVALID", "Use scheduledPickupAt instead of pickupTime.", { field: "scheduledPickupAt" });
  return { source: "pos", eventId: requiredText(record.eventId, "eventId"), idempotencyKey, items: record.items.map(parseItem), scheduledPickupAt: optionalText(record.scheduledPickupAt, "scheduledPickupAt"), paymentCollected: optionalCollected(record.paymentCollected), customerName: optionalText(record.customerName, "customerName"), customerPhoneTail: optionalPhoneTail(record.customerPhoneTail), paymentMethod: optionalPaymentMethod(record.paymentMethod), operator: clientText(record.operator, "operator", "local-pos"), deviceId: clientText(record.deviceId, "deviceId", "POS"), notes: optionalText(record.notes, "notes") };
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
  return createHash("sha256").update(JSON.stringify({ source: input.source, eventId: input.eventId, items, scheduledPickupAt: input.scheduledPickupAt, paymentCollected: input.paymentCollected, customerName: input.customerName, customerPhoneTail: input.customerPhoneTail, paymentMethod: input.paymentMethod, operator: input.operator, deviceId: input.deviceId, notes: input.notes })).digest("hex");
}

function requirePosChannel(snapshot: OrderProductSnapshot): void {
  // The row stays entirely inside Operations; the JSON is the frozen Event Product Contract snapshot.
  void snapshot;
}

export class OrderService {
  constructor(private readonly repository: OrderRepository, private readonly payments: PaymentRepository) {}

  createPosOrder(payload: unknown): CreateOrderResult {
    const parsed = parseInput(payload);
    const items = normalizeItems(parsed.items);
    const timestamp = now();
    return this.repository.transactionImmediate(() => {
      const event = this.repository.findEvent(parsed.eventId);
      if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found.");
      const input = { ...parsed, scheduledPickupAt: scheduledPickupAt(parsed.scheduledPickupAt, event) };
      if (input.scheduledPickupAt && input.paymentCollected) throw new HttpError(400, "RESERVATION_PREPAY_NOT_SUPPORTED", "Scheduled pickup Orders cannot be marked paid at creation in this phase.");
      if (input.paymentCollected && !input.paymentMethod) throw new HttpError(400, "PAYMENT_METHOD_REQUIRED", "Collected onsite payment requires paymentMethod.");
      const requestFingerprint = fingerprint(input, items);
      const existing = this.repository.findIdempotency(input.eventId, input.source, input.idempotencyKey);
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "The idempotency key was already used with a different request.");
        const order = this.repository.getOrder(existing.order_id);
        if (!order) throw new Error("Idempotency record references a missing order.");
        return { order, replayed: true };
      }

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
      const paymentStatus = input.paymentCollected ? "paid" : "unpaid";
      this.repository.insertOrder({ orderId, eventId: input.eventId, orderNumber, idempotencyKey: input.idempotencyKey, fingerprint: requestFingerprint, scheduledPickupAt: input.scheduledPickupAt, customerName: input.customerName, customerPhoneTail: input.customerPhoneTail, paymentMethod: input.paymentMethod, paymentStatus, paidTotal: input.paymentCollected ? subtotal : 0, notes: input.notes, subtotal, createdAt: timestamp });
      for (const { item, snapshot } of resolved) this.repository.insertOrderItem({ orderItemId: createId("order_item_"), orderId, item, snapshot, createdAt: timestamp });
      this.repository.insertIdempotency(input.eventId, input.idempotencyKey, requestFingerprint, orderId, timestamp);
      this.repository.insertAudit(orderId, input.eventId, orderNumber, resolved.reduce((total, entry) => total + entry.item.quantity, 0), subtotal, input.scheduledPickupAt, timestamp);
      if (input.paymentCollected && input.paymentMethod) {
        const paymentId = createId("payment_");
        const auditLogId = createId("audit_");
        this.payments.insertAudit({
          auditLogId,
          entityId: orderId,
          action: "payment_confirmed",
          metadata: {
            orderId,
            eventId: input.eventId,
            paymentId,
            paymentMethod: input.paymentMethod,
            amount: subtotal,
            paidAt: timestamp,
            operator: input.operator,
            deviceId: input.deviceId,
            identityTrust: "client_reported",
            source: "onsite_order_creation",
            fromPaymentStatus: "unpaid",
            toPaymentStatus: "paid"
          },
          occurredAt: timestamp
        });
        this.payments.insertPayment({
          paymentId,
          orderId,
          paymentMethod: input.paymentMethod,
          amount: subtotal,
          paidAt: timestamp,
          idempotencyKey: `order-payment:${requestFingerprint}`,
          requestFingerprint,
          operator: input.operator,
          deviceId: input.deviceId,
          auditLogId
        });
      }
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

  listEventOrders(eventId: string): OperationsOrder[] {
    if (!eventId.trim()) throw new HttpError(400, "VALIDATION_ERROR", "eventId is required.", { field: "eventId" });
    return this.repository.listEventOrders(eventId);
  }

  updateScheduledOrder(orderId: string, payload: unknown): OperationsOrder {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HttpError(400, "VALIDATION_ERROR", "Request body must be an object.");
    const value = payload as Record<string, unknown>;
    const expectedRevision = requiredText(value.expectedRevision, "expectedRevision");
    if (!Array.isArray(value.items) || value.items.length === 0) throw new HttpError(422, "RESERVATION_ITEMS_REQUIRED", "預約單至少需要一個品項。", { field: "items" });
    const items = value.items.map(parseItem);
    const customerName = optionalText(value.customerName, "customerName");
    const customerPhoneTail = optionalPhoneTail(value.customerPhoneTail);
    const paymentMethod = optionalPaymentMethod(value.paymentMethod);
    if (!paymentMethod) throw new HttpError(422, "PAYMENT_METHOD_REQUIRED", "請選擇付款方式。", { field: "paymentMethod" });
    const notes = optionalText(value.notes, "notes");
    const operator = clientText(value.operator, "operator", "local-pos");
    const device = clientText(value.deviceId, "deviceId", "POS");

    return this.repository.transactionImmediate(() => {
      const current = this.repository.getOrder(orderId);
      if (!current) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (this.repository.hasNonterminalModification(orderId)) throw new HttpError(409, "ORDER_MODIFICATION_PENDING", "此訂單已有尚未完成的修改，暫時不能再次編輯。");
      if (current.revision !== expectedRevision) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "預約單已被其他裝置更新，請重新整理後再試。");
      if (!current.scheduledPickupAt) throw new HttpError(409, "RESERVATION_ONLY", "Only scheduled pickup Orders can be edited here.");
      if (current.orderStatus !== "confirmed" || current.paymentStatus !== "unpaid" || current.productionStatus === "served") throw new HttpError(409, "RESERVATION_EDIT_LOCKED", "已出餐、已付款、已完成或已取消的預約單不可直接覆寫。");
      const event = this.repository.findEvent(current.eventId);
      if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found.");
      if (!["open", "paused"].includes(event.status)) throw new HttpError(409, "EVENT_NOT_OPERATIONAL", "Only an OPEN or PAUSED Event reservation can be edited.");
      const pickup = scheduledPickupAt(value.scheduledPickupAt, event);
      if (!pickup) throw new HttpError(422, "SCHEDULED_PICKUP_INVALID", "預約單必須保留取餐時間。", { field: "scheduledPickupAt" });
      const normalized = normalizeItems(items);
      const resolved = normalized.map((item) => {
        const product = this.repository.findProduct(current.eventId, item.productId);
        if (!product) throw new HttpError(404, "PRODUCT_NOT_IN_EVENT", "Product is not sellable in this event.");
        if (product.product_version_id !== item.productVersionId) throw new HttpError(409, "PRODUCT_VERSION_MISMATCH", "商品版本已變更，請重新整理後再試。");
        if (product.is_active !== 1 || !(JSON.parse(product.channels_json) as unknown[]).includes("pos")) throw new HttpError(409, "CHANNEL_NOT_ENABLED", "Product is not enabled for POS in this Event snapshot.");
        const snapshot = this.repository.getProductSnapshot(current.eventId, item);
        if (!snapshot) throw new HttpError(409, "PRODUCT_VERSION_MISMATCH", "商品版本已變更，請重新整理後再試。");
        return { item, snapshot };
      });
      const linesChanged = JSON.stringify(current.items.map((item) => ({ productId: item.productId, productVersionId: item.productVersionId, quantity: item.quantity, notes: item.notes }))) !== JSON.stringify(normalized);
      if (linesChanged && new Set(normalized.map((item) => item.productId)).size !== normalized.length) throw new HttpError(422, "DUPLICATE_PRODUCT", "同一商品不可重複加入預約單。", { field: "items" });
      if (linesChanged && !["not_started", "queued"].includes(current.productionStatus)) throw new HttpError(409, "RESERVATION_ITEMS_LOCKED", "餐點已開始製作，只能修改客人資料、取餐時間與訂單備註。");
      const subtotal = resolved.reduce((total, entry) => total + entry.snapshot.sellingPrice * entry.item.quantity, 0);
      const metadataChanged = current.scheduledPickupAt !== pickup || current.customerName !== customerName || current.customerPhoneTail !== customerPhoneTail || current.paymentMethod !== paymentMethod || current.notes !== notes;
      if (!linesChanged && !metadataChanged) throw new HttpError(422, "RESERVATION_NOT_CHANGED", "預約單沒有變更，未儲存。");
      const timestamp = now();
      if (linesChanged) {
        const totals = (source: readonly { productId: string; productVersionId: string; quantity: number }[]) => {
          const result = new Map<string, { productId: string; productVersionId: string; quantity: number }>();
          for (const item of source) {
            const key = `${item.productId}\u0000${item.productVersionId}`;
            const found = result.get(key);
            result.set(key, { productId: item.productId, productVersionId: item.productVersionId, quantity: (found?.quantity ?? 0) + item.quantity });
          }
          return result;
        };
        const before = totals(current.items), after = totals(normalized);
        for (const [key, item] of new Map([...before, ...after])) {
          const oldQuantity = before.get(key)?.quantity ?? 0;
          const newQuantity = after.get(key)?.quantity ?? 0;
          if (!this.repository.adjustSoldQuantity(current.eventId, item.productId, item.productVersionId, newQuantity - oldQuantity, timestamp)) throw new HttpError(409, "INSUFFICIENT_QUANTITY", "商品已售完或剩餘數量不足。");
        }
        this.repository.replaceOrderItems(orderId, resolved, timestamp);
      }
      if (!this.repository.updateReservationHeader(orderId, { scheduledPickupAt: pickup, customerName, customerPhoneTail, paymentMethod, notes, subtotal })) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "預約單已被其他裝置更新，請重新整理後再試。");
      const updated = this.repository.getOrder(orderId);
      if (!updated) throw new Error("Updated order could not be loaded.");
      this.repository.insertReservationRevisionAudit({ orderId, operator, deviceId: device, before: current, after: updated, occurredAt: timestamp });
      return updated;
    });
  }
}
