import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import { hasNonterminalEventModification as eventHasNonterminalModification, hasNonterminalOrderModification } from "./order-modification-lock.js";
import type { DailyReportReadPort } from "../domain/daily-report-read-port.js";
import type { DailyReport, OrderStatus, PaymentCloseoutReconciliation, PaymentMethod, PaymentStatus, ProductionStatus } from "../domain/types.js";

type OrderRow = { order_id: string; order_number: string; event_id: string; source: string; created_at: string; scheduled_pickup_at: string | null; customer_name: string | null; customer_phone_tail: string | null; payment_method: PaymentMethod | null; notes: string | null; order_status: OrderStatus; payment_status: PaymentStatus; production_status: ProductionStatus; cancellation_reason: string | null; grand_total: number; paid_total: number; served_at: string | null };
type EventRow = { event_id: string; event_code: string; display_name: string; date: string; start_time: string; end_time: string; status: string };
type ClosureRow = { daily_report_json: string };
type CloseoutRow = { cash_received: number; line_pay_received: number; other_received: number; waste_amount: number; notes: string; updated_at: string };
type CloseoutItemRow = { product_id: string; product_version_id: string; remaining_quantity: number; waste_quantity: number; retained_quantity: number; updated_at: string };
type AuditRow = { after_json: string | null };

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): boolean { return typeof value === "string" && value.length > 0; }
function amount(value: unknown): boolean { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function integer(value: unknown): boolean { return typeof value === "number" && Number.isSafeInteger(value); }
function amounts(value: unknown, keys: readonly string[]): boolean {
  const candidate = record(value);
  return !!candidate && keys.every((key) => amount(candidate[key]));
}
function integers(value: unknown, keys: readonly string[]): boolean {
  const candidate = record(value);
  return !!candidate && keys.every((key) => integer(candidate[key]));
}

function validReconciliation(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const candidate = record(value);
  if (!candidate || !amounts(candidate.expected, ["cash", "linePay"]) || !amounts(candidate.declared, ["cash", "linePay", "other"]) || !integers(candidate.variance, ["cash", "linePay"]) || !["matched", "exception_accepted"].includes(candidate.outcome as string)) return false;
  if (candidate.exception === null) return candidate.outcome === "matched";
  const exception = record(candidate.exception);
  return candidate.outcome === "exception_accepted" && !!exception && text(exception.reason) && text(exception.actor);
}

function storedDailyReport(value: string): DailyReport {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Stored Daily Report JSON is invalid."); }
  const report = record(parsed);
  const event = record(report?.event);
  const orders = record(report?.orders);
  const payments = record(report?.payments);
  const validEvent = !!event && ["eventId", "eventCode", "displayName", "date", "startTime", "endTime"].every((key) => text(event[key]));
  const validOrders = amounts(orders, ["total", "completed", "cancelled", "noShow"]);
  const validPayments = amounts(payments, ["cash", "linePay", "other"]);
  const validProducts = Array.isArray(report?.products) && report.products.every((item) => {
    const product = record(item);
    return !!product && text(product.productId) && text(product.posName) && amount(product.quantity) && amount(product.revenue);
  });
  if (!report || !validEvent || !validOrders || !validPayments || !validProducts || !text(report.closedAt)) {
    throw new Error("Stored Daily Report evidence is invalid.");
  }
  const paymentReconciliation = report.paymentReconciliation;
  if (!validReconciliation(paymentReconciliation)) {
    throw new Error("Stored Daily Report reconciliation evidence is invalid.");
  }
  return Object.freeze({ ...report, paymentReconciliation: paymentReconciliation ?? null }) as DailyReport;
}

export type PaymentCloseoutReconciliationCandidate = Readonly<{
  expected: Readonly<{ cash: number; linePay: number }>;
  declared: Readonly<{ cash: number; linePay: number; other: number }>;
  variance: Readonly<{ cash: number; linePay: number }>;
}>;

export type LifecycleOrder = Readonly<{ orderId: string; orderNumber: string; eventId: string; source: string; createdAt: string; scheduledPickupAt: string | null; customerName: string | null; customerPhoneTail: string | null; paymentMethod: PaymentMethod | null; notes: string | null; orderStatus: OrderStatus; paymentStatus: PaymentStatus; productionStatus: ProductionStatus; cancellationReason: string | null; grandTotal: number; paidTotal: number; servedAt: string | null; items: readonly Readonly<{ posName: string; quantity: number; notes: string | null }>[] }>;

export class LifecycleRepository implements DailyReportReadPort {
  constructor(private readonly database: DatabaseAdapter) {}
  transactionImmediate<T>(work: () => T): T { return this.database.transactionImmediate(work); }
  hasNonterminalModification(orderId: string): boolean { return hasNonterminalOrderModification(this.database, orderId); }
  hasNonterminalEventModification(eventId: string): boolean { return eventHasNonterminalModification(this.database, eventId); }
  findOrder(orderId: string): LifecycleOrder | undefined {
    const row = this.database.queryOne<OrderRow>("SELECT order_id, order_number, event_id, source, created_at, scheduled_pickup_at, customer_name, customer_phone_tail, payment_method, notes, order_status, payment_status, production_status, cancellation_reason, grand_total, paid_total, served_at FROM operations_orders WHERE order_id = ?", [orderId]);
    return row && this.mapOrder(row);
  }
  listEventOrders(eventId: string): LifecycleOrder[] {
    return this.database.queryMany<OrderRow>(`SELECT order_id, order_number, event_id, source, created_at, scheduled_pickup_at, customer_name, customer_phone_tail, payment_method, notes, order_status, payment_status, production_status, cancellation_reason, grand_total, paid_total, served_at
      FROM operations_orders
      WHERE event_id = ? AND order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)
      ORDER BY COALESCE(scheduled_pickup_at, created_at), order_number`, [eventId]).map((row) => this.mapOrder(row));
  }
  private mapOrder(row: OrderRow): LifecycleOrder { return { orderId: row.order_id, orderNumber: row.order_number, eventId: row.event_id, source: row.source, createdAt: row.created_at, scheduledPickupAt: row.scheduled_pickup_at, customerName: row.customer_name, customerPhoneTail: row.customer_phone_tail, paymentMethod: row.payment_method, notes: row.notes, orderStatus: row.order_status, paymentStatus: row.payment_status, productionStatus: row.production_status, cancellationReason: row.cancellation_reason, grandTotal: row.grand_total, paidTotal: row.paid_total, servedAt: row.served_at, items: this.database.queryMany<{ pos_name_snapshot: string; quantity: number; notes: string | null }>("SELECT pos_name_snapshot, quantity, notes FROM operations_order_items WHERE order_id = ? ORDER BY rowid", [row.order_id]).map((item) => ({ posName: item.pos_name_snapshot, quantity: item.quantity, notes: item.notes })) }; }
  updateProductionStatus(orderId: string, from: ProductionStatus, to: ProductionStatus, timestamp: string): boolean { return this.database.execute("UPDATE operations_orders SET production_status = ?, served_at = CASE WHEN ? = 'served' THEN ? ELSE served_at END WHERE order_id = ? AND production_status = ?", [to, to, timestamp, orderId, from]).changes === 1; }
  findProductionTransitionAudit(orderId: string, occurredAt: string): Record<string, unknown> | undefined {
    const row = this.database.queryOne<AuditRow>("SELECT after_json FROM audit_logs WHERE entity_type = 'order' AND entity_id = ? AND action = 'production_status_changed' AND occurred_at = ? ORDER BY rowid DESC LIMIT 1", [orderId, occurredAt]);
    if (!row?.after_json) return undefined;
    try {
      const metadata: unknown = JSON.parse(row.after_json);
      return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : undefined;
    } catch {
      return undefined;
    }
  }
  revertProductionCompletion(orderId: string, previous: ProductionStatus, originalServedAt: string): boolean {
    return this.database.execute("UPDATE operations_orders SET production_status = ?, served_at = NULL WHERE order_id = ? AND order_status = 'confirmed' AND production_status = 'served' AND served_at = ?", [previous, orderId, originalServedAt]).changes === 1;
  }
  completeOrder(orderId: string, timestamp: string): boolean { return this.database.execute("UPDATE operations_orders SET order_status = 'completed', status = 'completed', completed_at = ? WHERE order_id = ? AND order_status = 'confirmed' AND payment_status = 'paid' AND production_status = 'served'", [timestamp, orderId]).changes === 1; }
  cancelOrder(orderId: string, from: OrderStatus, reason: string | null, timestamp: string): boolean { return this.database.execute("UPDATE operations_orders SET order_status = 'cancelled', status = 'cancelled', cancellation_reason = ?, cancelled_at = ? WHERE order_id = ? AND order_status = ?", [reason, timestamp, orderId, from]).changes === 1; }
  insertAudit(input: { auditLogId: string; entityType: "order" | "event"; entityId: string; action: string; metadata: Record<string, unknown>; occurredAt: string }): void {
    this.database.execute("INSERT INTO audit_logs (audit_log_id, actor_user_id, entity_type, entity_id, action, before_json, after_json, occurred_at) VALUES (?, NULL, ?, ?, ?, NULL, ?, ?)", [input.auditLogId, input.entityType, input.entityId, input.action, JSON.stringify(input.metadata), input.occurredAt]);
  }
  hasRelease(orderId: string): boolean { return this.database.queryOne<{ order_id: string }>("SELECT order_id FROM operations_inventory_releases WHERE order_id = ?", [orderId]) !== undefined; }
  insertRelease(orderId: string, timestamp: string, operator: string, auditLogId: string): void { this.database.execute("INSERT INTO operations_inventory_releases (order_id, released_at, operator, audit_log_id) VALUES (?, ?, ?, ?)", [orderId, timestamp, operator, auditLogId]); }
  releaseItems(orderId: string, eventId: string, timestamp: string): boolean {
    const items = this.database.queryMany<{ product_id: string; product_version_id: string; quantity: number }>("SELECT product_id, product_version_id, quantity FROM operations_order_items WHERE order_id = ?", [orderId]);
    for (const item of items) {
      const changed = this.database.execute("UPDATE operations_sellable_inventory SET sold_quantity = sold_quantity - ?, updated_at = ? WHERE event_id = ? AND product_id = ? AND product_version_id = ? AND sold_quantity >= ?", [item.quantity, timestamp, eventId, item.product_id, item.product_version_id, item.quantity]).changes;
      if (changed !== 1) return false;
    }
    return true;
  }
  findEvent(eventId: string): EventRow | undefined { return this.database.queryOne<EventRow>("SELECT event_id, event_code, display_name, date, start_time, end_time, status FROM operations_events WHERE event_id = ?", [eventId]); }
  findClosure(eventId: string): DailyReport | undefined {
    return this.findDailyReport(eventId);
  }
  findDailyReport(eventId: string): DailyReport | undefined {
    const row = this.database.queryOne<ClosureRow>("SELECT daily_report_json FROM operations_event_closures WHERE event_id = ?", [eventId]);
    if (!row) return undefined;
    return storedDailyReport(row.daily_report_json);
  }
  listDailyReports(): readonly DailyReport[] {
    return Object.freeze(this.database.queryMany<ClosureRow>("SELECT daily_report_json FROM operations_event_closures ORDER BY closed_at DESC, event_id ASC")
      .map((row) => storedDailyReport(row.daily_report_json))
      .sort((left, right) => right.closedAt.localeCompare(left.closedAt) || left.event.eventId.localeCompare(right.event.eventId)));
  }
  private paymentTotals(eventId: string): Readonly<{ cash: number; linePay: number; total: number }> {
    const row = this.database.queryOne<{ cash: number; line_pay: number; total: number }>(`SELECT
      COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' AND p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS cash,
      COALESCE(SUM(CASE WHEN p.payment_method = 'LINE_PAY' AND p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS line_pay,
      COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS total
      FROM operations_payments p JOIN operations_orders o ON o.order_id = p.order_id WHERE o.event_id = ?`, [eventId]) ?? { cash: 0, line_pay: 0, total: 0 };
    return { cash: row.cash, linePay: row.line_pay, total: row.total };
  }
  getPaymentCloseoutReconciliation(eventId: string): PaymentCloseoutReconciliationCandidate | undefined {
    const closeout = this.database.queryOne<CloseoutRow>("SELECT cash_received, line_pay_received, other_received, waste_amount, notes, updated_at FROM operations_event_closeouts WHERE event_id = ?", [eventId]);
    if (!closeout) return undefined;
    const payments = this.paymentTotals(eventId);
    return {
      expected: { cash: payments.cash, linePay: payments.linePay },
      declared: { cash: closeout.cash_received, linePay: closeout.line_pay_received, other: closeout.other_received },
      variance: { cash: closeout.cash_received - payments.cash, linePay: closeout.line_pay_received - payments.linePay }
    };
  }
  getStatistics(eventId: string): Record<string, unknown> {
    const event = this.findEvent(eventId); if (!event) return {};
    const totals = this.database.queryOne<{ orders: number; amount: number; unresolved: number; cancelled: number; no_show: number; scheduled: number }>(`SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN grand_total ELSE 0 END), 0) AS amount, SUM(CASE WHEN order_status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS unresolved, SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN cancellation_reason = 'no_show' THEN 1 ELSE 0 END) AS no_show, SUM(CASE WHEN scheduled_pickup_at IS NOT NULL AND order_status != 'cancelled' THEN 1 ELSE 0 END) AS scheduled
      FROM operations_orders WHERE event_id = ?
        AND order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)`, [eventId]) ?? { orders: 0, amount: 0, unresolved: 0, cancelled: 0, no_show: 0, scheduled: 0 };
    const products = this.database.queryMany<{ product_id: string; pos_name_snapshot: string; quantity: number }>(`SELECT i.product_id, i.pos_name_snapshot, SUM(i.quantity) AS quantity FROM operations_order_items i JOIN operations_orders o ON o.order_id = i.order_id WHERE o.event_id = ? AND o.order_status != 'cancelled'
      AND o.order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)
      GROUP BY i.product_id, i.pos_name_snapshot ORDER BY i.pos_name_snapshot`, [eventId]);
    const inventory = this.database.queryMany<{ product_id: string; product_version_id: string; pos_name: string; remaining: number }>("SELECT i.product_id, i.product_version_id, COALESCE(p.pos_name, i.product_id) AS pos_name, i.planned_quantity - i.reserved_quantity - i.sold_quantity AS remaining FROM operations_sellable_inventory i LEFT JOIN operations_product_copies p ON p.product_version_id = i.product_version_id WHERE i.event_id = ?", [eventId]);
    const closeout = this.database.queryOne<CloseoutRow>("SELECT cash_received, line_pay_received, other_received, waste_amount, notes, updated_at FROM operations_event_closeouts WHERE event_id = ?", [eventId]);
    const closeoutItems = this.database.queryMany<CloseoutItemRow>("SELECT product_id, product_version_id, remaining_quantity, waste_quantity, retained_quantity, updated_at FROM operations_event_closeout_items WHERE event_id = ? ORDER BY product_version_id", [eventId]);
    const payments = this.paymentTotals(eventId);
    return { event, orderCount: totals.orders, scheduledOrderCount: totals.scheduled ?? 0, ledgerAmount: totals.amount, receivedAmount: payments.total, cashReceivedAmount: payments.cash, linePayReceivedAmount: payments.linePay, paymentReceiptExpected: { cash: payments.cash, linePay: payments.linePay }, unresolvedCount: totals.unresolved ?? 0, cancelledCount: totals.cancelled ?? 0, noShowCount: totals.no_show ?? 0, products, inventory: inventory.map((item) => ({ productId: item.product_id, productVersionId: item.product_version_id, posName: item.pos_name, remainingQuantity: item.remaining })), closeout: closeout ? { cashReceived: closeout.cash_received, linePayReceived: closeout.line_pay_received, otherReceived: closeout.other_received, wasteAmount: closeout.waste_amount, notes: closeout.notes, updatedAt: closeout.updated_at } : null, closeoutItems: closeoutItems.map((item) => ({ productId: item.product_id, productVersionId: item.product_version_id, remainingQuantity: item.remaining_quantity, wasteQuantity: item.waste_quantity, retainedQuantity: item.retained_quantity, updatedAt: item.updated_at })) };
  }
  saveCloseout(eventId: string, input: { cashReceived: number; linePayReceived: number; otherReceived: number; wasteAmount: number; notes: string; updatedAt: string; operator: string; auditLogId: string }): void {
    this.database.execute(`INSERT INTO operations_event_closeouts (event_id, cash_received, line_pay_received, other_received, waste_amount, notes, updated_at, updated_by, audit_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id) DO UPDATE SET cash_received=excluded.cash_received, line_pay_received=excluded.line_pay_received, other_received=excluded.other_received, waste_amount=excluded.waste_amount, notes=excluded.notes, updated_at=excluded.updated_at, updated_by=excluded.updated_by, audit_log_id=excluded.audit_log_id`, [eventId, input.cashReceived, input.linePayReceived, input.otherReceived, input.wasteAmount, input.notes, input.updatedAt, input.operator, input.auditLogId]);
  }
  listInventoryForCloseout(eventId: string): readonly Readonly<{ productId: string; productVersionId: string; remainingQuantity: number }>[] {
    return this.database.queryMany<{ product_id: string; product_version_id: string; remaining_quantity: number }>("SELECT product_id, product_version_id, planned_quantity - reserved_quantity - sold_quantity AS remaining_quantity FROM operations_sellable_inventory WHERE event_id = ? ORDER BY product_version_id", [eventId]).map((item) => ({ productId: item.product_id, productVersionId: item.product_version_id, remainingQuantity: item.remaining_quantity }));
  }
  replaceCloseoutItems(eventId: string, items: readonly Readonly<{ productId: string; productVersionId: string; remainingQuantity: number; wasteQuantity: number; retainedQuantity: number; updatedAt: string }>[]): void {
    this.database.execute("DELETE FROM operations_event_closeout_items WHERE event_id = ?", [eventId]);
    for (const item of items) this.database.execute("INSERT INTO operations_event_closeout_items (event_id, product_id, product_version_id, remaining_quantity, waste_quantity, retained_quantity, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [eventId, item.productId, item.productVersionId, item.remainingQuantity, item.wasteQuantity, item.retainedQuantity, item.updatedAt]);
  }
  hasCompleteCloseout(eventId: string): boolean {
    const inventory = this.listInventoryForCloseout(eventId);
    const items = this.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_event_closeout_items WHERE event_id = ?", [eventId])?.count ?? 0;
    return inventory.length === items;
  }
  unresolvedCount(eventId: string): number { return this.database.queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM operations_orders
    WHERE event_id = ? AND order_status NOT IN ('completed', 'cancelled')
      AND order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)`, [eventId])?.count ?? 0; }
  buildReport(event: EventRow, closedAt: string, paymentReconciliation: PaymentCloseoutReconciliation): DailyReport {
    const counts = this.database.queryOne<{ total: number; completed: number; cancelled: number; no_show: number }>(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN order_status = 'cancelled' AND cancellation_reason = 'no_show' THEN 1 ELSE 0 END) AS no_show
      FROM operations_orders WHERE event_id = ?
        AND order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)`, [event.event_id]) ?? { total: 0, completed: 0, cancelled: 0, no_show: 0 };
    const products = this.database.queryMany<{ product_id: string; pos_name_snapshot: string; quantity: number; revenue: number }>(`SELECT i.product_id, i.pos_name_snapshot, SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue
      FROM operations_order_items i JOIN operations_orders o ON o.order_id = i.order_id
      WHERE o.event_id = ? AND o.order_status = 'completed'
        AND o.order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)
      GROUP BY i.product_id, i.pos_name_snapshot ORDER BY i.pos_name_snapshot`, [event.event_id]);
    const payments = this.paymentTotals(event.event_id);
    return { event: { eventId: event.event_id, eventCode: event.event_code, displayName: event.display_name, date: event.date, startTime: event.start_time, endTime: event.end_time }, orders: { total: counts.total, completed: counts.completed ?? 0, cancelled: counts.cancelled ?? 0, noShow: counts.no_show ?? 0 }, products: products.map((item) => ({ productId: item.product_id, posName: item.pos_name_snapshot, quantity: item.quantity, revenue: item.revenue })), payments: { cash: payments.cash, linePay: payments.linePay, other: 0 }, paymentReconciliation, closedAt };
  }
  insertClosure(eventId: string, report: DailyReport, timestamp: string, operator: string, auditLogId: string): void { this.database.execute("INSERT INTO operations_event_closures (event_id, closed_at, operator, daily_report_json, audit_log_id) VALUES (?, ?, ?, ?, ?)", [eventId, timestamp, operator, JSON.stringify(report), auditLogId]); }
  closeEvent(eventId: string, timestamp: string): boolean { return this.database.execute("UPDATE operations_events SET status = 'closed', updated_at = ? WHERE event_id = ? AND status IN ('open', 'paused')", [timestamp, eventId]).changes === 1; }
}
