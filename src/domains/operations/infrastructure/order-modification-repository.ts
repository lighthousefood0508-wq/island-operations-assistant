import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type {
  FrozenOrderModificationLine,
  OrderModificationIntent,
  OrderModificationIntentState
} from "../domain/order-modification.js";
import type { OperationsOrder, PaymentMethod } from "../domain/types.js";
import { OrderRepository, type OrderProductSnapshot } from "./order-repository.js";
import { hasNonterminalEventModification, hasNonterminalOrderModification, resolveOrderModificationRoot } from "./order-modification-lock.js";

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

  netCollected(orderId: string): number {
    const rootOrderId = this.resolveRootOrderId(orderId);
    const original = this.database.queryOne<{ amount: number }>(`SELECT COALESCE(SUM(p.amount), 0) AS amount
      FROM operations_payments p
      JOIN operations_orders o ON o.order_id = p.order_id
      WHERE p.payment_status = 'paid'
        AND (o.order_id = ? OR o.order_id IN (
          SELECT superseded_order_id FROM operations_order_replacements WHERE root_order_id = ?
          UNION SELECT replacement_order_id FROM operations_order_replacements WHERE root_order_id = ?
        ))`, [rootOrderId, rootOrderId, rootOrderId])?.amount ?? 0;
    const adjustments = this.database.queryOne<{ amount: number }>(`SELECT COALESCE(SUM(CASE direction WHEN 'supplement' THEN amount ELSE -amount END), 0) AS amount
      FROM operations_payment_adjustments WHERE root_order_id = ?`, [rootOrderId])?.amount ?? 0;
    return original + adjustments;
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
