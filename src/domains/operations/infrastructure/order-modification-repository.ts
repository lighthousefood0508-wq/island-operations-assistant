import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type {
  FrozenOrderModificationLine,
  OrderItemDispositionEvidence,
  OrderModificationHeldReservation,
  OrderModificationIntent,
  OrderModificationIntentState,
  OrderReplacementEvidence,
  PaymentAdjustmentEvidence
} from "../domain/order-modification.js";
import type { OperationsOrder, PaymentLedgerProjection, PaymentMethod } from "../domain/types.js";
import { OrderRepository, type OrderProductSnapshot } from "./order-repository.js";
import { hasNonterminalEventModification, hasNonterminalOrderModification, resolveOrderModificationRoot } from "./order-modification-lock.js";
import { readOrderChainPaymentLedger } from "./payment-ledger-projection.js";

type EventRow = Readonly<{
  event_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}>;

type IntentRow = Readonly<{
  intent_id: string;
  event_id: string;
  root_order_id: string;
  effective_order_id: string;
  expected_effective_revision: string;
  state: OrderModificationIntentState;
  intent_revision: number;
  idempotency_key: string;
  request_fingerprint: string;
  before_json: string;
  after_json: string;
  difference_json: string;
  original_collected: number;
  new_total: number;
  adjustment_amount: number;
  adjustment_direction: "none" | "supplement" | "refund";
  adjustment_method: PaymentMethod | null;
  payment_basis_status: "unpaid" | "paid";
  outcome_kind: "replacement" | "cancellation";
  production_reset_required: number;
  created_by: string;
  device_id: string;
  created_at: string;
  expires_at: string | null;
  last_renewed_at: string | null;
  external_started_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  reconciliation_required_at: string | null;
  transitioned_by: string | null;
  transition_reason: string | null;
}>;

type ReplacementRow = Readonly<{
  replacement_id: string;
  intent_id: string;
  root_order_id: string;
  superseded_order_id: string;
  replacement_order_id: string;
  effective_revision: number;
  created_at: string;
}>;

type AdjustmentRow = Readonly<{
  payment_adjustment_id: string;
  intent_id: string;
  root_order_id: string;
  effective_order_id: string;
  replacement_order_id: string | null;
  direction: "supplement" | "refund";
  payment_method: PaymentMethod;
  amount: number;
  external_reference: string | null;
  idempotency_key: string;
  request_fingerprint: string;
  confirmed_by: string;
  device_id: string;
  occurred_at: string;
}>;

type DispositionRow = Readonly<{
  disposition_id: string;
  intent_id: string;
  replacement_id: string | null;
  source_order_id: string;
  source_order_item_id: string;
  product_id: string;
  product_version_id: string;
  display_name_snapshot: string;
  pos_name_snapshot: string;
  unit_selling_price: number;
  removed_quantity: number;
  returned_to_sellable_quantity: number;
  not_returned_quantity: number;
  reason: string;
  recorded_by: string;
  device_id: string;
  occurred_at: string;
}>;

export type PreparedIntentInsert = Omit<OrderModificationIntent, "state" | "intentRevision" | "externalStartedAt" | "confirmedAt" | "cancelledAt" | "expiredAt" | "reconciliationRequiredAt" | "transitionedBy" | "transitionReason"> & Readonly<{
  state: "prepared";
  intentRevision: 1;
}>;

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function mapIntent(row: IntentRow): OrderModificationIntent {
  return {
    intentId: row.intent_id,
    eventId: row.event_id,
    rootOrderId: row.root_order_id,
    effectiveOrderId: row.effective_order_id,
    expectedEffectiveRevision: row.expected_effective_revision,
    state: row.state,
    intentRevision: row.intent_revision,
    idempotencyKey: row.idempotency_key,
    requestFingerprint: row.request_fingerprint,
    before: parseJson<OperationsOrder>(row.before_json),
    after: parseJson<OrderModificationIntent["after"]>(row.after_json),
    difference: parseJson<OrderModificationIntent["difference"]>(row.difference_json),
    originalCollected: row.original_collected,
    newTotal: row.new_total,
    adjustmentAmount: row.adjustment_amount,
    adjustmentDirection: row.adjustment_direction,
    adjustmentMethod: row.adjustment_method,
    paymentBasisStatus: row.payment_basis_status,
    outcomeKind: row.outcome_kind,
    productionResetRequired: row.production_reset_required === 1,
    createdBy: row.created_by,
    deviceId: row.device_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastRenewedAt: row.last_renewed_at,
    externalStartedAt: row.external_started_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    reconciliationRequiredAt: row.reconciliation_required_at,
    transitionedBy: row.transitioned_by,
    transitionReason: row.transition_reason
  };
}

function mapReplacement(row: ReplacementRow): OrderReplacementEvidence {
  return {
    replacementId: row.replacement_id,
    intentId: row.intent_id,
    rootOrderId: row.root_order_id,
    supersededOrderId: row.superseded_order_id,
    replacementOrderId: row.replacement_order_id,
    effectiveRevision: row.effective_revision,
    createdAt: row.created_at
  };
}

function mapAdjustment(row: AdjustmentRow): PaymentAdjustmentEvidence {
  return {
    paymentAdjustmentId: row.payment_adjustment_id,
    intentId: row.intent_id,
    rootOrderId: row.root_order_id,
    effectiveOrderId: row.effective_order_id,
    replacementOrderId: row.replacement_order_id,
    direction: row.direction,
    paymentMethod: row.payment_method,
    amount: row.amount,
    externalReference: row.external_reference,
    idempotencyKey: row.idempotency_key,
    requestFingerprint: row.request_fingerprint,
    confirmedBy: row.confirmed_by,
    deviceId: row.device_id,
    occurredAt: row.occurred_at
  };
}

function mapDisposition(row: DispositionRow): OrderItemDispositionEvidence {
  return {
    dispositionId: row.disposition_id,
    intentId: row.intent_id,
    replacementId: row.replacement_id,
    sourceOrderId: row.source_order_id,
    sourceOrderItemId: row.source_order_item_id,
    productId: row.product_id,
    productVersionId: row.product_version_id,
    displayNameSnapshot: row.display_name_snapshot,
    posNameSnapshot: row.pos_name_snapshot,
    unitSellingPrice: row.unit_selling_price,
    removedQuantity: row.removed_quantity,
    returnedToSellableQuantity: row.returned_to_sellable_quantity,
    notReturnedQuantity: row.not_returned_quantity,
    reason: row.reason,
    recordedBy: row.recorded_by,
    deviceId: row.device_id,
    occurredAt: row.occurred_at
  };
}

export class OrderModificationRepository {
  private readonly orders: OrderRepository;

  constructor(private readonly database: DatabaseAdapter) {
    this.orders = new OrderRepository(database);
  }

  transactionImmediate<T>(work: () => T): T {
    return this.database.transactionImmediate(work);
  }

  findEvent(eventId: string): EventRow | undefined {
    return this.database.queryOne<EventRow>("SELECT event_id, date, start_time, end_time, status FROM operations_events WHERE event_id = ?", [eventId]);
  }

  findOrder(orderId: string): OperationsOrder | undefined {
    return this.orders.getOrder(orderId);
  }

  findProductSnapshot(eventId: string, productId: string, productVersionId: string): OrderProductSnapshot | undefined {
    return this.orders.getProductSnapshot(eventId, { productId, productVersionId, quantity: 1, notes: null });
  }

  resolveRootOrderId(orderId: string): string {
    return resolveOrderModificationRoot(this.database, orderId);
  }

  resolveEffectiveOrderId(orderId: string): string {
    const rootOrderId = this.resolveRootOrderId(orderId);
    return this.database.queryOne<{ replacement_order_id: string }>(`SELECT replacement_order_id
      FROM operations_order_replacements WHERE root_order_id = ?
      ORDER BY effective_revision DESC LIMIT 1`, [rootOrderId])?.replacement_order_id ?? rootOrderId;
  }

  hasNonterminalOrderIntent(orderId: string): boolean {
    return hasNonterminalOrderModification(this.database, orderId);
  }

  hasNonterminalEventIntent(eventId: string): boolean {
    return hasNonterminalEventModification(this.database, eventId);
  }

  findByIdempotencyKey(idempotencyKey: string): OrderModificationIntent | undefined {
    const row = this.database.queryOne<IntentRow>("SELECT * FROM operations_order_modification_intents WHERE idempotency_key = ?", [idempotencyKey]);
    return row ? mapIntent(row) : undefined;
  }

  findIntent(intentId: string): OrderModificationIntent | undefined {
    const row = this.database.queryOne<IntentRow>("SELECT * FROM operations_order_modification_intents WHERE intent_id = ?", [intentId]);
    return row ? mapIntent(row) : undefined;
  }

  findActiveIntentForOrder(orderId: string): OrderModificationIntent | undefined {
    const rootOrderId = this.resolveRootOrderId(orderId);
    const row = this.database.queryOne<IntentRow>(`SELECT *
      FROM operations_order_modification_intents
      WHERE root_order_id = ?
        AND state IN ('prepared', 'external_in_progress', 'reconciliation_required')
      LIMIT 1`, [rootOrderId]);
    return row ? mapIntent(row) : undefined;
  }

  findOrderNumber(orderId: string): string | undefined {
    return this.database.queryOne<{ order_number: string }>(
      "SELECT order_number FROM operations_orders WHERE order_id = ?",
      [orderId]
    )?.order_number;
  }

  findReplacementByIntent(intentId: string): OrderReplacementEvidence | undefined {
    const row = this.database.queryOne<ReplacementRow>(`SELECT replacement_id, intent_id,
      root_order_id, superseded_order_id, replacement_order_id, effective_revision, created_at
      FROM operations_order_replacements WHERE intent_id = ?`, [intentId]);
    return row ? mapReplacement(row) : undefined;
  }

  findPaymentAdjustmentByIntent(intentId: string): PaymentAdjustmentEvidence | undefined {
    const row = this.database.queryOne<AdjustmentRow>(`SELECT payment_adjustment_id, intent_id,
      root_order_id, effective_order_id, replacement_order_id, direction, payment_method,
      amount, external_reference, idempotency_key, request_fingerprint, confirmed_by,
      device_id, occurred_at FROM operations_payment_adjustments WHERE intent_id = ?`, [intentId]);
    return row ? mapAdjustment(row) : undefined;
  }

  listDispositions(intentId: string): readonly OrderItemDispositionEvidence[] {
    return this.database.queryMany<DispositionRow>(`SELECT disposition_id, intent_id,
      replacement_id, source_order_id, source_order_item_id, product_id,
      product_version_id, display_name_snapshot, pos_name_snapshot, unit_selling_price,
      removed_quantity, returned_to_sellable_quantity, not_returned_quantity, reason,
      recorded_by, device_id, occurred_at
      FROM operations_order_item_dispositions WHERE intent_id = ?
      ORDER BY source_order_item_id`, [intentId]).map(mapDisposition);
  }

  netCollected(orderId: string): number {
    return this.paymentLedger(orderId).net.total;
  }

  paymentLedger(orderId: string): PaymentLedgerProjection {
    return readOrderChainPaymentLedger(this.database, orderId);
  }

  reserveQuantity(input: { eventId: string; productId: string; productVersionId: string; quantity: number; timestamp: string }): boolean {
    return this.database.execute(`UPDATE operations_sellable_inventory
      SET reserved_quantity = reserved_quantity + ?, updated_at = ?
      WHERE event_id = ? AND product_id = ? AND product_version_id = ? AND is_enabled = 1
        AND planned_quantity - reserved_quantity - sold_quantity >= ?`,
    [input.quantity, input.timestamp, input.eventId, input.productId, input.productVersionId, input.quantity]).changes === 1;
  }

  insertPreparedIntent(intent: PreparedIntentInsert): void {
    this.database.execute(`INSERT INTO operations_order_modification_intents (
      intent_id, event_id, root_order_id, effective_order_id, expected_effective_revision,
      state, intent_revision, idempotency_key, request_fingerprint, before_json, after_json,
      difference_json, original_collected, new_total, adjustment_amount,
      adjustment_direction, adjustment_method, payment_basis_status, outcome_kind,
      production_reset_required, created_by, device_id, created_at, expires_at,
      last_renewed_at
    ) VALUES (?, ?, ?, ?, ?, 'prepared', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      intent.intentId,
      intent.eventId,
      intent.rootOrderId,
      intent.effectiveOrderId,
      intent.expectedEffectiveRevision,
      intent.idempotencyKey,
      intent.requestFingerprint,
      JSON.stringify(intent.before),
      JSON.stringify(intent.after),
      JSON.stringify(intent.difference),
      intent.originalCollected,
      intent.newTotal,
      intent.adjustmentAmount,
      intent.adjustmentDirection,
      intent.adjustmentMethod,
      intent.paymentBasisStatus,
      intent.outcomeKind,
      intent.productionResetRequired ? 1 : 0,
      intent.createdBy,
      intent.deviceId,
      intent.createdAt,
      intent.expiresAt,
      intent.lastRenewedAt
    ]);
  }

  insertIntentItem(intentId: string, line: FrozenOrderModificationLine): void {
    this.database.execute(`INSERT INTO operations_order_modification_intent_items (
      intent_item_id, intent_id, line_sequence, product_id, product_version_id,
      display_name_snapshot, pos_name_snapshot, display_category_name_snapshot,
      unit_list_price, unit_selling_price, quantity, line_discount, line_total,
      notes, cost_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      line.intentItemId,
      intentId,
      line.lineSequence,
      line.productId,
      line.productVersionId,
      line.displayNameSnapshot,
      line.posNameSnapshot,
      line.displayCategoryNameSnapshot,
      line.unitListPrice,
      line.unitSellingPrice,
      line.quantity,
      line.lineDiscount,
      line.lineTotal,
      line.notes,
      line.costStatus
    ]);
  }

  insertReservation(input: { reservationId: string; intentId: string; eventId: string; productId: string; productVersionId: string; quantity: number; createdAt: string }): void {
    this.database.execute(`INSERT INTO operations_order_modification_reservations
      (reservation_id, intent_id, event_id, product_id, product_version_id, reserved_quantity, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'held', ?)`, [input.reservationId, input.intentId, input.eventId, input.productId, input.productVersionId, input.quantity, input.createdAt]);
  }

  listHeldReservations(intentId: string): readonly Readonly<{ reservationId: string; eventId: string; productId: string; productVersionId: string; quantity: number }>[] {
    return this.database.queryMany<{ reservation_id: string; event_id: string; product_id: string; product_version_id: string; reserved_quantity: number }>(`SELECT reservation_id, event_id, product_id, product_version_id, reserved_quantity
      FROM operations_order_modification_reservations WHERE intent_id = ? AND status = 'held'`, [intentId]).map((row) => ({
        reservationId: row.reservation_id,
        eventId: row.event_id,
        productId: row.product_id,
        productVersionId: row.product_version_id,
        quantity: row.reserved_quantity
      }));
  }

  listRecoveryReservations(intentId: string): readonly OrderModificationHeldReservation[] {
    return this.listHeldReservations(intentId).map(({ reservationId, productId, productVersionId, quantity }) => ({
      reservationId,
      productId,
      productVersionId,
      quantity
    }));
  }

  releaseHeldReservation(input: { reservationId: string; eventId: string; productId: string; productVersionId: string; quantity: number; actor: string; timestamp: string }): boolean {
    const inventory = this.database.execute(`UPDATE operations_sellable_inventory
      SET reserved_quantity = reserved_quantity - ?, updated_at = ?
      WHERE event_id = ? AND product_id = ? AND product_version_id = ? AND reserved_quantity >= ?`,
    [input.quantity, input.timestamp, input.eventId, input.productId, input.productVersionId, input.quantity]);
    if (inventory.changes !== 1) return false;
    return this.database.execute(`UPDATE operations_order_modification_reservations
      SET status = 'released', terminal_at = ?, terminal_by = ?
      WHERE reservation_id = ? AND status = 'held'`, [input.timestamp, input.actor, input.reservationId]).changes === 1;
  }

  renewPrepared(intentId: string, expectedRevision: number, now: string, expiresAt: string, actor: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET intent_revision = intent_revision + 1, expires_at = ?, last_renewed_at = ?, transitioned_by = ?
      WHERE intent_id = ? AND state = 'prepared' AND intent_revision = ? AND expires_at > ?
        AND (last_renewed_at IS NULL OR last_renewed_at <= ?)`,
    [expiresAt, now, actor, intentId, expectedRevision, now, new Date(Date.parse(now) - 30_000).toISOString()]).changes === 1;
  }

  transitionPreparedToCancelled(intentId: string, expectedRevision: number, actor: string, reason: string, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET state = 'cancelled', intent_revision = intent_revision + 1, cancelled_at = ?, transitioned_by = ?, transition_reason = ?
      WHERE intent_id = ? AND state = 'prepared' AND intent_revision = ? AND expires_at > ?`, [timestamp, actor, reason, intentId, expectedRevision, timestamp]).changes === 1;
  }

  transitionToExternalInProgress(intentId: string, expectedRevision: number, actor: string, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET state = 'external_in_progress', intent_revision = intent_revision + 1,
          external_started_at = ?, expires_at = NULL, last_renewed_at = NULL,
          transitioned_by = ?
      WHERE intent_id = ? AND state = 'prepared' AND intent_revision = ?
        AND expires_at > ? AND adjustment_amount > 0`, [timestamp, actor, intentId, expectedRevision, timestamp]).changes === 1;
  }

  transitionToReconciliationRequired(intentId: string, expectedRevision: number, actor: string, reason: string, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET state = 'reconciliation_required', intent_revision = intent_revision + 1,
          reconciliation_required_at = ?, transitioned_by = ?, transition_reason = ?
      WHERE intent_id = ? AND state = 'external_in_progress' AND intent_revision = ?`, [timestamp, actor, reason, intentId, expectedRevision]).changes === 1;
  }

  markReconciliationAfterFailure(intentId: string, actor: string, reason: string, timestamp: string): boolean {
    const current = this.findIntent(intentId);
    if (current?.state === "reconciliation_required") return true;
    if (current?.state !== "external_in_progress") return false;
    return this.transitionToReconciliationRequired(intentId, current.intentRevision, actor, reason, timestamp);
  }

  transitionExternalOrReconciliationToCancelled(intentId: string, expectedRevision: number, actor: string, reason: string, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET state = 'cancelled', intent_revision = intent_revision + 1,
          cancelled_at = ?, transitioned_by = ?, transition_reason = ?
      WHERE intent_id = ?
        AND state IN ('external_in_progress', 'reconciliation_required')
        AND intent_revision = ?`, [timestamp, actor, reason, intentId, expectedRevision]).changes === 1;
  }

  transitionToConfirmed(intentId: string, expectedRevision: number, actor: string, reason: string, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET state = 'confirmed', intent_revision = intent_revision + 1,
          confirmed_at = ?, transitioned_by = ?, transition_reason = ?
      WHERE intent_id = ?
        AND state IN ('prepared', 'external_in_progress', 'reconciliation_required')
        AND intent_revision = ?
        AND (state != 'prepared' OR expires_at > ?)`, [timestamp, actor, reason, intentId, expectedRevision, timestamp]).changes === 1;
  }

  transitionPreparedToExpired(intentId: string, expectedRevision: number, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_order_modification_intents
      SET state = 'expired', intent_revision = intent_revision + 1, expired_at = ?, transitioned_by = 'system', transition_reason = 'prepared_lease_expired'
      WHERE intent_id = ? AND state = 'prepared' AND intent_revision = ? AND expires_at <= ?`, [timestamp, intentId, expectedRevision, timestamp]).changes === 1;
  }

  listExpiredPrepared(timestamp: string): readonly Readonly<{ intentId: string; intentRevision: number }>[] {
    return this.database.queryMany<{ intent_id: string; intent_revision: number }>(`SELECT intent_id, intent_revision
      FROM operations_order_modification_intents
      WHERE state = 'prepared' AND expires_at <= ? ORDER BY expires_at, intent_id`, [timestamp]).map((row) => ({ intentId: row.intent_id, intentRevision: row.intent_revision }));
  }

  nextReplacementRevision(rootOrderId: string): number {
    return (this.database.queryOne<{ revision: number }>(`SELECT COALESCE(MAX(effective_revision), 1) + 1 AS revision
      FROM operations_order_replacements WHERE root_order_id = ?`, [rootOrderId])?.revision ?? 2);
  }

  allocateOrderNumber(eventId: string, timestamp: string): string {
    const eventCode = this.database.queryOne<{ event_code: string }>(
      "SELECT event_code FROM operations_events WHERE event_id = ?",
      [eventId]
    )?.event_code;
    if (!eventCode) throw new Error("Event order number could not be allocated.");
    this.database.execute(
      "INSERT OR IGNORE INTO operations_event_order_sequences (event_id, next_sequence, updated_at) VALUES (?, 1, ?)",
      [eventId, timestamp]
    );
    const sequence = this.database.queryOne<{ next_sequence: number }>(
      "SELECT next_sequence FROM operations_event_order_sequences WHERE event_id = ?",
      [eventId]
    )?.next_sequence;
    if (!sequence) throw new Error("Event order number could not be allocated.");
    this.database.execute(
      "UPDATE operations_event_order_sequences SET next_sequence = ?, updated_at = ? WHERE event_id = ?",
      [sequence + 1, timestamp, eventId]
    );
    return `${eventCode}-${String(sequence).padStart(3, "0")}`;
  }

  insertReplacementOrder(input: {
    orderId: string;
    orderNumber: string;
    intent: OrderModificationIntent;
    paymentStatus: "unpaid" | "paid";
    paidTotal: number;
    timestamp: string;
  }): void {
    this.database.execute(`INSERT INTO operations_orders (
      order_id, event_id, channel, status, subtotal, discount_total, grand_total,
      paid_total, idempotency_key, created_at, order_number, source, order_status,
      payment_status, production_status, scheduled_pickup_at, customer_name,
      customer_phone_tail, payment_method, notes, request_fingerprint, confirmed_at
    ) VALUES (?, ?, 'pos', 'confirmed', ?, 0, ?, ?, ?, ?, ?, 'pos', 'confirmed',
      ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      input.orderId,
      input.intent.eventId,
      input.intent.newTotal,
      input.intent.newTotal,
      input.paidTotal,
      `order-modification:${input.intent.intentId}`,
      input.timestamp,
      input.orderNumber,
      input.paymentStatus,
      input.intent.after.productionStatus,
      input.intent.after.scheduledPickupAt,
      input.intent.after.customerName,
      input.intent.after.customerPhoneTail,
      input.intent.after.paymentMethod,
      input.intent.after.notes,
      input.intent.requestFingerprint,
      input.timestamp
    ]);
  }

  insertReplacementOrderItem(input: {
    orderItemId: string;
    orderId: string;
    line: FrozenOrderModificationLine;
    timestamp: string;
  }): void {
    const line = input.line;
    this.database.execute(`INSERT INTO operations_order_items (
      order_item_id, order_id, product_id, product_version_id, display_name_snapshot,
      quantity, unit_price, discount_amount, line_total, pos_name_snapshot,
      display_category_name_snapshot, unit_list_price, unit_selling_price,
      line_discount, notes, cost_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      input.orderItemId,
      input.orderId,
      line.productId,
      line.productVersionId,
      line.displayNameSnapshot,
      line.quantity,
      line.unitSellingPrice,
      line.lineDiscount,
      line.lineTotal,
      line.posNameSnapshot,
      line.displayCategoryNameSnapshot,
      line.unitListPrice,
      line.unitSellingPrice,
      line.lineDiscount,
      line.notes,
      line.costStatus,
      input.timestamp
    ]);
  }

  insertReplacement(input: {
    replacementId: string;
    intent: OrderModificationIntent;
    replacementOrderId: string;
    effectiveRevision: number;
    reason: string;
    actor: string;
    deviceId: string;
    timestamp: string;
  }): void {
    this.database.execute(`INSERT INTO operations_order_replacements (
      replacement_id, intent_id, event_id, root_order_id, superseded_order_id,
      replacement_order_id, effective_revision, reason, created_by, device_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      input.replacementId,
      input.intent.intentId,
      input.intent.eventId,
      input.intent.rootOrderId,
      input.intent.effectiveOrderId,
      input.replacementOrderId,
      input.effectiveRevision,
      input.reason,
      input.actor,
      input.deviceId,
      input.timestamp
    ]);
  }

  commitHeldReservation(input: {
    reservationId: string;
    eventId: string;
    productId: string;
    productVersionId: string;
    quantity: number;
    actor: string;
    timestamp: string;
  }): boolean {
    const inventory = this.database.execute(`UPDATE operations_sellable_inventory
      SET reserved_quantity = reserved_quantity - ?, sold_quantity = sold_quantity + ?, updated_at = ?
      WHERE event_id = ? AND product_id = ? AND product_version_id = ?
        AND reserved_quantity >= ?`, [
      input.quantity,
      input.quantity,
      input.timestamp,
      input.eventId,
      input.productId,
      input.productVersionId,
      input.quantity
    ]);
    if (inventory.changes !== 1) return false;
    return this.database.execute(`UPDATE operations_order_modification_reservations
      SET status = 'committed', terminal_at = ?, terminal_by = ?
      WHERE reservation_id = ? AND status = 'held'`, [
      input.timestamp,
      input.actor,
      input.reservationId
    ]).changes === 1;
  }

  returnToSellable(input: {
    eventId: string;
    productId: string;
    productVersionId: string;
    quantity: number;
    timestamp: string;
  }): boolean {
    if (input.quantity === 0) return true;
    return this.database.execute(`UPDATE operations_sellable_inventory
      SET sold_quantity = sold_quantity - ?, updated_at = ?
      WHERE event_id = ? AND product_id = ? AND product_version_id = ?
        AND sold_quantity >= ?`, [
      input.quantity,
      input.timestamp,
      input.eventId,
      input.productId,
      input.productVersionId,
      input.quantity
    ]).changes === 1;
  }

  cancelEffectiveOrder(input: {
    orderId: string;
    expectedRevision: string;
    paymentStatus: "unpaid" | "refunded";
    timestamp: string;
  }): boolean {
    const current = this.orders.getOrder(input.orderId);
    if (!current || current.revision !== input.expectedRevision) return false;
    return this.database.execute(`UPDATE operations_orders
      SET order_status = 'cancelled', status = 'cancelled', payment_status = ?,
          cancellation_reason = 'order_modified_cancelled', cancelled_at = ?
      WHERE order_id = ? AND order_status = 'confirmed'`, [
      input.paymentStatus,
      input.timestamp,
      input.orderId
    ]).changes === 1;
  }

  findAdjustmentByExternalReference(externalReference: string): PaymentAdjustmentEvidence | undefined {
    const row = this.database.queryOne<AdjustmentRow>(`SELECT payment_adjustment_id, intent_id,
      root_order_id, effective_order_id, replacement_order_id, direction, payment_method,
      amount, external_reference, idempotency_key, request_fingerprint, confirmed_by,
      device_id, occurred_at FROM operations_payment_adjustments
      WHERE payment_method = 'LINE_PAY' AND external_reference = ?`, [externalReference]);
    return row ? mapAdjustment(row) : undefined;
  }

  insertPaymentAdjustment(input: PaymentAdjustmentEvidence): void {
    this.database.execute(`INSERT INTO operations_payment_adjustments (
      payment_adjustment_id, intent_id, root_order_id, effective_order_id,
      replacement_order_id, direction, payment_method, amount, external_reference,
      idempotency_key, request_fingerprint, confirmed_by, device_id, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      input.paymentAdjustmentId,
      input.intentId,
      input.rootOrderId,
      input.effectiveOrderId,
      input.replacementOrderId,
      input.direction,
      input.paymentMethod,
      input.amount,
      input.externalReference,
      input.idempotencyKey,
      input.requestFingerprint,
      input.confirmedBy,
      input.deviceId,
      input.occurredAt
    ]);
  }

  insertDisposition(input: OrderItemDispositionEvidence): void {
    this.database.execute(`INSERT INTO operations_order_item_dispositions (
      disposition_id, intent_id, replacement_id, source_order_id,
      source_order_item_id, product_id, product_version_id, display_name_snapshot,
      pos_name_snapshot, unit_selling_price, removed_quantity,
      returned_to_sellable_quantity, not_returned_quantity, reason, recorded_by,
      device_id, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      input.dispositionId,
      input.intentId,
      input.replacementId,
      input.sourceOrderId,
      input.sourceOrderItemId,
      input.productId,
      input.productVersionId,
      input.displayNameSnapshot,
      input.posNameSnapshot,
      input.unitSellingPrice,
      input.removedQuantity,
      input.returnedToSellableQuantity,
      input.notReturnedQuantity,
      input.reason,
      input.recordedBy,
      input.deviceId,
      input.occurredAt
    ]);
  }

  insertAudit(input: { auditLogId: string; entityId: string; action: string; actor: string; deviceId: string; before: unknown; after: unknown; occurredAt: string }): void {
    this.database.execute(`INSERT INTO audit_logs
      (audit_log_id, actor_user_id, entity_type, entity_id, action, before_json, after_json, occurred_at)
      VALUES (?, NULL, 'order_modification_intent', ?, ?, ?, ?, ?)`, [
      input.auditLogId,
      input.entityId,
      input.action,
      JSON.stringify({ actor: input.actor, deviceId: input.deviceId, value: input.before }),
      JSON.stringify({ actor: input.actor, deviceId: input.deviceId, value: input.after }),
      input.occurredAt
    ]);
  }

}
