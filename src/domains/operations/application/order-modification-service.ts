import { createHash } from "node:crypto";
import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import type {
  FrozenOrderModificationDisposition,
  FrozenOrderModificationLine,
  OrderModificationIntent,
  OrderModificationItemInput,
  OrderModificationPrepareResult,
  PrepareOrderModificationCommand
} from "../domain/order-modification.js";
import type { OperationsOrder, PaymentMethod, ProductionStatus } from "../domain/types.js";
import { OrderModificationRepository, type PreparedIntentInsert } from "../infrastructure/order-modification-repository.js";

const PREPARED_LEASE_MS = 10 * 60_000;

function text(value: unknown, field: string, maximum: number, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string") throw new HttpError(422, "ORDER_MODIFICATION_INVALID", `${field} must be text.`, { field });
  const result = value.trim();
  if (!result && nullable) return null;
  if (!result || result.length > maximum) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", `${field} is invalid.`, { field });
  return result;
}

function nullableNote(value: unknown, field: string): string | null {
  return text(value, field, 1000, true);
}

function paymentMethod(value: unknown, field: string, nullable: boolean): PaymentMethod | null {
  if (value === null && nullable) return null;
  if (value !== "CASH" && value !== "LINE_PAY") throw new HttpError(422, "ORDER_MODIFICATION_INVALID", `${field} must be CASH or LINE_PAY.`, { field });
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", `${field} must be a positive integer.`, { field });
  return value as number;
}

function nonnegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", `${field} must be a non-negative integer.`, { field });
  return value as number;
}

function nullablePhoneTail(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{3}$/.test(value.trim())) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "customerPhoneTail must contain exactly three digits.", { field: "customerPhoneTail" });
  return value.trim();
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function validateScheduledPickupAt(value: unknown, event: Readonly<{ date: string; start_time: string; end_time: string }>): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new HttpError(422, "SCHEDULED_PICKUP_INVALID", "scheduledPickupAt must be null or an offset-bearing Event-local ISO instant.", { field: "scheduledPickupAt" });
  const instant = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d):[0-5]\d(?:\.\d{1,3})?\+08:00$/.exec(instant);
  if (!match?.[1] || !match[2]) throw new HttpError(422, "SCHEDULED_PICKUP_INVALID", "scheduledPickupAt must be an offset-bearing Event-local ISO instant.", { field: "scheduledPickupAt" });
  const date = match[1];
  const pickupTime = match[2];
  const overnight = event.start_time > event.end_time;
  const inWindow = overnight ? pickupTime >= event.start_time || pickupTime <= event.end_time : pickupTime >= event.start_time && pickupTime <= event.end_time;
  const expectedDate = overnight && pickupTime <= event.end_time ? nextDate(event.date) : event.date;
  if (!inWindow || date !== expectedDate) throw new HttpError(422, "SCHEDULED_PICKUP_OUTSIDE_EVENT", "scheduledPickupAt must be within the Event operating time.", { field: "scheduledPickupAt" });
  return instant;
}

function parseCommand(input: unknown): PrepareOrderModificationCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "Modification command must be an object.");
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.items)) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "items must be an array.", { field: "items" });
  if (value.items.length > 100) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "items may contain at most 100 entries.", { field: "items" });
  const items = value.items.map((entry, index): OrderModificationItemInput => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "Each item must be an object.", { field: `items[${index}]` });
    const item = entry as Record<string, unknown>;
    return {
      productId: text(item.productId, `items[${index}].productId`, 200)!,
      productVersionId: text(item.productVersionId, `items[${index}].productVersionId`, 200)!,
      quantity: positiveInteger(item.quantity, `items[${index}].quantity`),
      notes: nullableNote(item.notes ?? null, `items[${index}].notes`)
    };
  }).sort((left, right) => left.productId.localeCompare(right.productId));
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw new HttpError(422, "ORDER_MODIFICATION_DUPLICATE_PRODUCT", "同一商品不可重複加入訂單。", { field: "items" });
  if (!Array.isArray(value.dispositions)) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "dispositions must be an array.", { field: "dispositions" });
  if (value.dispositions.length > 100) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "dispositions may contain at most 100 entries.", { field: "dispositions" });
  const dispositions = value.dispositions.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "Each disposition must be an object.", { field: `dispositions[${index}]` });
    const disposition = entry as Record<string, unknown>;
    return {
      orderItemId: text(disposition.orderItemId, `dispositions[${index}].orderItemId`, 200)!,
      returnedToSellableQuantity: nonnegativeInteger(disposition.returnedToSellableQuantity, `dispositions[${index}].returnedToSellableQuantity`),
      notReturnedQuantity: nonnegativeInteger(disposition.notReturnedQuantity, `dispositions[${index}].notReturnedQuantity`),
      reason: text(disposition.reason, `dispositions[${index}].reason`, 500)!
    };
  }).sort((left, right) => left.orderItemId.localeCompare(right.orderItemId));
  if (new Set(dispositions.map((entry) => entry.orderItemId)).size !== dispositions.length) throw new HttpError(422, "ORDER_MODIFICATION_INVALID", "Each removed Order item may have one disposition.", { field: "dispositions" });
  return {
    orderId: text(value.orderId, "orderId", 200)!,
    expectedRevision: text(value.expectedRevision, "expectedRevision", 200)!,
    idempotencyKey: text(value.idempotencyKey, "idempotencyKey", 200)!,
    items,
    scheduledPickupAt: value.scheduledPickupAt === null ? null : text(value.scheduledPickupAt, "scheduledPickupAt", 100)!,
    customerName: text(value.customerName ?? null, "customerName", 200, true),
    customerPhoneTail: nullablePhoneTail(value.customerPhoneTail ?? null),
    paymentMethod: paymentMethod(value.paymentMethod ?? null, "paymentMethod", true),
    notes: nullableNote(value.notes ?? null, "notes"),
    supplementMethod: paymentMethod(value.supplementMethod ?? null, "supplementMethod", true),
    dispositions,
    actor: text(value.actor, "actor", 100)!,
    deviceId: text(value.deviceId, "deviceId", 100)!
  };
}

function canonicalFingerprint(command: PrepareOrderModificationCommand): string {
  return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}

function itemFacts(items: readonly FrozenOrderModificationLine[]): readonly Readonly<{ productId: string; productVersionId: string; quantity: number; notes: string | null }>[] {
  return items.map(({ productId, productVersionId, quantity, notes }) => ({ productId, productVersionId, quantity, notes }));
}

function sameItems(before: OperationsOrder, after: readonly FrozenOrderModificationLine[]): boolean {
  const left = before.items.map(({ productId, productVersionId, quantity, notes }) => ({ productId, productVersionId, quantity, notes })).sort((a, b) => a.productId.localeCompare(b.productId));
  return JSON.stringify(left) === JSON.stringify(itemFacts(after));
}

export class OrderModificationService {
  constructor(
    private readonly repository: OrderModificationRepository,
    private readonly clock: () => Date = () => new Date()
  ) {}

  prepare(input: unknown): OrderModificationPrepareResult {
    const command = parseCommand(input);
    const fingerprint = canonicalFingerprint(command);
    return this.repository.transactionImmediate(() => {
      const replay = this.repository.findByIdempotencyKey(command.idempotencyKey);
      if (replay) {
        if (replay.requestFingerprint !== fingerprint) throw new HttpError(409, "ORDER_MODIFICATION_IDEMPOTENCY_CONFLICT", "The idempotency key was already used with different modification content.");
        return { intent: replay, replayed: true };
      }
      const effectiveOrderId = this.repository.resolveEffectiveOrderId(command.orderId);
      const current = this.repository.findOrder(effectiveOrderId);
      if (!current) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      const rootOrderId = this.repository.resolveRootOrderId(effectiveOrderId);
      if (this.repository.hasNonterminalOrderIntent(rootOrderId)) throw new HttpError(409, "ORDER_MODIFICATION_PENDING", "此訂單已有尚未完成的修改，請先恢復原修改流程。");
      if (current.revision !== command.expectedRevision) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "訂單已被其他裝置更新，請重新整理後再試。");
      if (current.orderStatus !== "confirmed") throw new HttpError(409, "ORDER_MODIFICATION_LOCKED", "已完成或已取消的訂單不可修改。");
      if (current.productionStatus === "served" || current.productionStatus === "cancelled") throw new HttpError(409, "ORDER_MODIFICATION_PRODUCTION_LOCKED", "已出餐的訂單必須先依既有流程復原後才能修改。");
      if (current.paymentStatus !== "unpaid" && current.paymentStatus !== "paid") throw new HttpError(409, "ORDER_MODIFICATION_PAYMENT_STATE_UNSUPPORTED", "目前付款狀態需要先完成核對，不能直接修改訂單。");
      if (!command.paymentMethod) throw new HttpError(422, "ORDER_MODIFICATION_PAYMENT_METHOD_REQUIRED", "訂單必須保留現金或 LINE Pay 付款方式。", { field: "paymentMethod" });
      if (current.paymentStatus === "paid" && command.paymentMethod !== current.paymentMethod) throw new HttpError(409, "ORDER_MODIFICATION_PAYMENT_METHOD_LOCKED", "已付款訂單不得改寫原付款方式；補收或退款方式會另行保存為調整證據。", { field: "paymentMethod" });
      const event = this.repository.findEvent(current.eventId);
      if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found.");
      if (event.status !== "open" && event.status !== "paused") throw new HttpError(409, "EVENT_NOT_OPERATIONAL", "Only an OPEN or PAUSED Event Order can be modified.");
      const scheduledPickupAt = validateScheduledPickupAt(command.scheduledPickupAt, event);

      const beforeByProduct = new Map(current.items.map((item) => [item.productId, item]));
      const lines: FrozenOrderModificationLine[] = command.items.map((item, lineSequence) => {
        const before = beforeByProduct.get(item.productId);
        if (before && before.productVersionId !== item.productVersionId) throw new HttpError(409, "PRODUCT_VERSION_MISMATCH", "商品版本已變更，請重新整理後再試。");
        const needsCurrentAvailability = !before || item.quantity > before.quantity;
        const currentSnapshot = needsCurrentAvailability ? this.repository.findProductSnapshot(current.eventId, item.productId, item.productVersionId) : undefined;
        if (needsCurrentAvailability && !currentSnapshot) throw new HttpError(409, "PRODUCT_NOT_SELLABLE", "新增或增加的商品目前不可販售。");
        const snapshot = currentSnapshot ?? (before ? {
          productId: before.productId,
          productVersionId: before.productVersionId,
          displayName: before.displayNameSnapshot,
          posName: before.posNameSnapshot,
          displayCategoryName: before.displayCategoryNameSnapshot,
          sellingPrice: before.unitSellingPrice
        } : undefined);
        if (!snapshot) throw new HttpError(409, "PRODUCT_NOT_SELLABLE", "商品目前不可販售。");
        const lineTotal = snapshot.sellingPrice * item.quantity;
        if (!Number.isSafeInteger(lineTotal)) throw new HttpError(422, "ORDER_MODIFICATION_TOTAL_OVERFLOW", "商品數量或金額超出可安全計算範圍。");
        return {
          intentItemId: createId("intent_item_"),
          lineSequence,
          productId: item.productId,
          productVersionId: item.productVersionId,
          displayNameSnapshot: snapshot.displayName,
          posNameSnapshot: snapshot.posName,
          displayCategoryNameSnapshot: snapshot.displayCategoryName,
          unitListPrice: snapshot.sellingPrice,
          unitSellingPrice: snapshot.sellingPrice,
          quantity: item.quantity,
          lineDiscount: 0,
          lineTotal,
          notes: item.notes,
          costStatus: "unavailable"
        };
      });

      const afterByProduct = new Map(lines.map((item) => [item.productId, item]));
      const dispositionsByItem = new Map(command.dispositions.map((entry) => [entry.orderItemId, entry]));
      const dispositions: FrozenOrderModificationDisposition[] = [];
      for (const before of current.items) {
        const removedQuantity = before.quantity - (afterByProduct.get(before.productId)?.quantity ?? 0);
        if (removedQuantity <= 0) continue;
        const disposition = dispositionsByItem.get(before.orderItemId);
        if (!disposition || disposition.returnedToSellableQuantity + disposition.notReturnedQuantity !== removedQuantity) throw new HttpError(422, "ORDER_MODIFICATION_DISPOSITION_REQUIRED", "刪減餐點必須確認回到可售與不回售的數量。", { orderItemId: before.orderItemId, removedQuantity: String(removedQuantity) });
        dispositions.push({
          sourceOrderItemId: before.orderItemId,
          productId: before.productId,
          productVersionId: before.productVersionId,
          removedQuantity,
          returnedToSellableQuantity: disposition.returnedToSellableQuantity,
          notReturnedQuantity: disposition.notReturnedQuantity,
          reason: disposition.reason
        });
        dispositionsByItem.delete(before.orderItemId);
      }
      if (dispositionsByItem.size) throw new HttpError(422, "ORDER_MODIFICATION_DISPOSITION_INVALID", "Disposition contains an Order item that was not removed.");

      const reservations = lines.flatMap((line) => {
        const increase = line.quantity - (beforeByProduct.get(line.productId)?.quantity ?? 0);
        return increase > 0 ? [{ productId: line.productId, productVersionId: line.productVersionId, quantity: increase }] : [];
      });
      const itemsChanged = !sameItems(current, lines);
      const productionContentChanged = itemsChanged || current.notes !== command.notes;
      const metadataChanged = current.scheduledPickupAt !== scheduledPickupAt
        || current.customerName !== command.customerName
        || current.customerPhoneTail !== command.customerPhoneTail
        || current.paymentMethod !== command.paymentMethod;
      if (!productionContentChanged && !metadataChanged) throw new HttpError(422, "ORDER_MODIFICATION_NOT_CHANGED", "訂單沒有實質變更，未建立修改。");

      const outcomeKind = lines.length ? "replacement" : "cancellation";
      const newTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const originalCollected = current.paymentStatus === "paid" ? this.repository.netCollected(current.orderId) : 0;
      if (!Number.isSafeInteger(newTotal) || !Number.isSafeInteger(originalCollected)) throw new HttpError(422, "ORDER_MODIFICATION_TOTAL_OVERFLOW", "訂單金額超出可安全計算範圍。");
      if (current.paymentStatus === "paid" && originalCollected <= 0) throw new HttpError(409, "ORDER_MODIFICATION_PAYMENT_EVIDENCE_MISSING", "已付款訂單缺少可核對的付款證據。");
      const difference = current.paymentStatus === "paid" ? newTotal - originalCollected : 0;
      const adjustmentDirection = difference > 0 ? "supplement" : difference < 0 ? "refund" : "none";
      const adjustmentAmount = Math.abs(difference);
      const adjustmentMethod = adjustmentDirection === "refund"
        ? current.paymentMethod
        : adjustmentDirection === "supplement"
          ? command.supplementMethod
          : null;
      if (adjustmentDirection !== "none" && !adjustmentMethod) throw new HttpError(422, "ORDER_MODIFICATION_ADJUSTMENT_METHOD_REQUIRED", "補收或退款必須有可核對的付款方式。");

      const timestamp = this.clock().toISOString();
      const expiresAt = new Date(Date.parse(timestamp) + PREPARED_LEASE_MS).toISOString();
      const productionStatus: ProductionStatus = current.productionStatus === "ready" && productionContentChanged ? "preparing" : current.productionStatus;
      const intentId = createId("mod_intent_");
      const after = {
        scheduledPickupAt,
        customerName: command.customerName,
        customerPhoneTail: command.customerPhoneTail,
        paymentMethod: command.paymentMethod,
        notes: command.notes,
        productionStatus,
        items: lines
      } as const;
      const differenceEvidence = {
        itemCountChanged: current.items.reduce((sum, item) => sum + item.quantity, 0) !== lines.reduce((sum, item) => sum + item.quantity, 0),
        productionContentChanged,
        metadataChanged,
        reservations,
        dispositions
      } as const;
      const intent: PreparedIntentInsert = {
        intentId,
        eventId: current.eventId,
        rootOrderId,
        effectiveOrderId: current.orderId,
        expectedEffectiveRevision: current.revision,
        state: "prepared",
        intentRevision: 1,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: fingerprint,
        before: current,
        after,
        difference: differenceEvidence,
        originalCollected,
        newTotal,
        adjustmentAmount,
        adjustmentDirection,
        adjustmentMethod,
        paymentBasisStatus: current.paymentStatus,
        outcomeKind,
        productionResetRequired: current.productionStatus === "ready" && productionContentChanged,
        createdBy: command.actor,
        deviceId: command.deviceId,
        createdAt: timestamp,
        expiresAt,
        lastRenewedAt: timestamp
      };

      for (const reservation of reservations) {
        if (!this.repository.reserveQuantity({ eventId: current.eventId, ...reservation, timestamp })) throw new HttpError(409, "INSUFFICIENT_QUANTITY", "商品已售完或剩餘數量不足。");
      }
      this.repository.insertPreparedIntent(intent);
      for (const line of lines) this.repository.insertIntentItem(intentId, line);
      for (const reservation of reservations) this.repository.insertReservation({ reservationId: createId("mod_reservation_"), intentId, eventId: current.eventId, ...reservation, createdAt: timestamp });
      const saved = this.getIntent(intentId);
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityId: intentId, action: "order.modification_prepared", actor: command.actor, deviceId: command.deviceId, before: current, after: saved, occurredAt: timestamp });
      return { intent: saved, replayed: false };
    });
  }

  getIntent(intentId: string): OrderModificationIntent {
    const intent = this.repository.findIntent(intentId);
    if (!intent) throw new HttpError(404, "ORDER_MODIFICATION_INTENT_NOT_FOUND", "Order modification intent was not found.");
    return intent;
  }

  renew(intentId: string, expectedRevision: number, actor: string): OrderModificationIntent {
    const timestamp = this.clock().toISOString();
    const expiresAt = new Date(Date.parse(timestamp) + PREPARED_LEASE_MS).toISOString();
    return this.repository.transactionImmediate(() => {
      if (!this.repository.renewPrepared(intentId, expectedRevision, timestamp, expiresAt, text(actor, "actor", 100)!)) throw new HttpError(409, "ORDER_MODIFICATION_RENEWAL_CONFLICT", "修改保留無法續期，請重新載入目前狀態。");
      return this.getIntent(intentId);
    });
  }

  cancelPrepared(intentId: string, expectedRevision: number, actor: string, reason: string): OrderModificationIntent {
    const timestamp = this.clock().toISOString();
    const normalizedActor = text(actor, "actor", 100)!;
    const normalizedReason = text(reason, "reason", 500)!;
    return this.repository.transactionImmediate(() => {
      const before = this.getIntent(intentId);
      if (!this.repository.transitionPreparedToCancelled(intentId, expectedRevision, normalizedActor, normalizedReason, timestamp)) throw new HttpError(409, "ORDER_MODIFICATION_CANCEL_CONFLICT", "只有仍有效的 prepared 修改可以取消。");
      this.releaseReservations(intentId, normalizedActor, timestamp);
      const after = this.getIntent(intentId);
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityId: intentId, action: "order.modification_cancelled", actor: normalizedActor, deviceId: before.deviceId, before, after, occurredAt: timestamp });
      return after;
    });
  }

  beginExternalAction(intentId: string, expectedRevision: number, actor: string): OrderModificationIntent {
    const timestamp = this.clock().toISOString();
    const normalizedActor = text(actor, "actor", 100)!;
    return this.repository.transactionImmediate(() => {
      const before = this.getIntent(intentId);
      if (!this.repository.transitionToExternalInProgress(intentId, expectedRevision, normalizedActor, timestamp)) throw new HttpError(409, "ORDER_MODIFICATION_EXTERNAL_START_CONFLICT", "修改已變更、逾時或不需要外部款項。");
      const after = this.getIntent(intentId);
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityId: intentId, action: "order.modification_external_started", actor: normalizedActor, deviceId: before.deviceId, before, after, occurredAt: timestamp });
      return after;
    });
  }

  requireReconciliation(intentId: string, expectedRevision: number, actor: string, reason: string): OrderModificationIntent {
    const timestamp = this.clock().toISOString();
    const normalizedActor = text(actor, "actor", 100)!;
    const normalizedReason = text(reason, "reason", 500)!;
    return this.repository.transactionImmediate(() => {
      const before = this.getIntent(intentId);
      if (!this.repository.transitionToReconciliationRequired(intentId, expectedRevision, normalizedActor, normalizedReason, timestamp)) throw new HttpError(409, "ORDER_MODIFICATION_RECONCILIATION_CONFLICT", "只有 external_in_progress 修改可以轉入款項核對。");
      const after = this.getIntent(intentId);
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityId: intentId, action: "order.modification_reconciliation_required", actor: normalizedActor, deviceId: before.deviceId, before, after, occurredAt: timestamp });
      return after;
    });
  }

  expirePrepared(): number {
    const timestamp = this.clock().toISOString();
    let expired = 0;
    for (const candidate of this.repository.listExpiredPrepared(timestamp)) {
      const changed = this.repository.transactionImmediate(() => {
        const before = this.repository.findIntent(candidate.intentId);
        if (!before || !this.repository.transitionPreparedToExpired(candidate.intentId, candidate.intentRevision, timestamp)) return false;
        this.releaseReservations(candidate.intentId, "system", timestamp);
        const after = this.getIntent(candidate.intentId);
        this.repository.insertAudit({ auditLogId: createId("audit_"), entityId: candidate.intentId, action: "order.modification_expired", actor: "system", deviceId: before.deviceId, before, after, occurredAt: timestamp });
        return true;
      });
      if (changed) expired += 1;
    }
    return expired;
  }

  private releaseReservations(intentId: string, actor: string, timestamp: string): void {
    for (const reservation of this.repository.listHeldReservations(intentId)) {
      if (!this.repository.releaseHeldReservation({ ...reservation, actor, timestamp })) throw new HttpError(409, "ORDER_MODIFICATION_RESERVATION_RELEASE_FAILED", "修改保留數量無法安全釋放。");
    }
  }
}
