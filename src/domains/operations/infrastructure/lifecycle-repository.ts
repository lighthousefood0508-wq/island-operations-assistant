import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { DailyReport, OrderStatus, PaymentStatus, ProductionStatus } from "../domain/types.js";

type OrderRow = { order_id: string; order_number: string; event_id: string; source: string; created_at: string; customer_name: string | null; notes: string | null; order_status: OrderStatus; payment_status: PaymentStatus; production_status: ProductionStatus; cancellation_reason: string | null; grand_total: number };
type EventRow = { event_id: string; event_code: string; display_name: string; date: string; start_time: string; end_time: string; status: string };
type ClosureRow = { daily_report_json: string };
type CloseoutRow = { cash_received: number; line_pay_received: number; other_received: number; waste_amount: number; notes: string; updated_at: string };

export type LifecycleOrder = Readonly<{ orderId: string; orderNumber: string; eventId: string; source: string; createdAt: string; customerName: string | null; notes: string | null; orderStatus: OrderStatus; paymentStatus: PaymentStatus; productionStatus: ProductionStatus; cancellationReason: string | null; grandTotal: number; items: readonly Readonly<{ posName: string; quantity: number; notes: string | null }>[] }>;

export class LifecycleRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  transactionImmediate<T>(work: () => T): T { return this.database.transactionImmediate(work); }
  findOrder(orderId: string): LifecycleOrder | undefined {
    const row = this.database.queryOne<OrderRow>("SELECT order_id, order_number, event_id, source, created_at, customer_name, notes, order_status, payment_status, production_status, cancellation_reason, grand_total FROM operations_orders WHERE order_id = ?", [orderId]);
    return row && this.mapOrder(row);
  }
  listEventOrders(eventId: string): LifecycleOrder[] {
    return this.database.queryMany<OrderRow>("SELECT order_id, order_number, event_id, source, created_at, customer_name, notes, order_status, payment_status, production_status, cancellation_reason, grand_total FROM operations_orders WHERE event_id = ? ORDER BY created_at, order_number", [eventId]).map((row) => this.mapOrder(row));
  }
  private mapOrder(row: OrderRow): LifecycleOrder { return { orderId: row.order_id, orderNumber: row.order_number, eventId: row.event_id, source: row.source, createdAt: row.created_at, customerName: row.customer_name, notes: row.notes, orderStatus: row.order_status, paymentStatus: row.payment_status, productionStatus: row.production_status, cancellationReason: row.cancellation_reason, grandTotal: row.grand_total, items: this.database.queryMany<{ pos_name_snapshot: string; quantity: number; notes: string | null }>("SELECT pos_name_snapshot, quantity, notes FROM operations_order_items WHERE order_id = ? ORDER BY rowid", [row.order_id]).map((item) => ({ posName: item.pos_name_snapshot, quantity: item.quantity, notes: item.notes })) }; }
  updateProductionStatus(orderId: string, from: ProductionStatus, to: ProductionStatus): boolean { return this.database.execute("UPDATE operations_orders SET production_status = ? WHERE order_id = ? AND production_status = ?", [to, orderId, from]).changes === 1; }
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
  findClosure(eventId: string): DailyReport | undefined { const row = this.database.queryOne<ClosureRow>("SELECT daily_report_json FROM operations_event_closures WHERE event_id = ?", [eventId]); return row ? JSON.parse(row.daily_report_json) as DailyReport : undefined; }
  getStatistics(eventId: string): Record<string, unknown> {
    const event = this.findEvent(eventId); if (!event) return {};
    const totals = this.database.queryOne<{ orders: number; amount: number; unresolved: number; cancelled: number; no_show: number }>(`SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN grand_total ELSE 0 END), 0) AS amount, SUM(CASE WHEN order_status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS unresolved, SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN cancellation_reason = 'no_show' THEN 1 ELSE 0 END) AS no_show FROM operations_orders WHERE event_id = ?`, [eventId]) ?? { orders: 0, amount: 0, unresolved: 0, cancelled: 0, no_show: 0 };
    const products = this.database.queryMany<{ product_id: string; pos_name_snapshot: string; quantity: number }>(`SELECT i.product_id, i.pos_name_snapshot, SUM(i.quantity) AS quantity FROM operations_order_items i JOIN operations_orders o ON o.order_id = i.order_id WHERE o.event_id = ? AND o.order_status != 'cancelled' GROUP BY i.product_id, i.pos_name_snapshot ORDER BY i.pos_name_snapshot`, [eventId]);
    const inventory = this.database.queryMany<{ product_id: string; remaining: number }>("SELECT product_id, planned_quantity - reserved_quantity - sold_quantity AS remaining FROM operations_sellable_inventory WHERE event_id = ?", [eventId]);
    const closeout = this.database.queryOne<CloseoutRow>("SELECT cash_received, line_pay_received, other_received, waste_amount, notes, updated_at FROM operations_event_closeouts WHERE event_id = ?", [eventId]);
    return { event, orderCount: totals.orders, ledgerAmount: totals.amount, unresolvedCount: totals.unresolved, cancelledCount: totals.cancelled, noShowCount: totals.no_show, products, inventory, closeout: closeout ? { cashReceived: closeout.cash_received, linePayReceived: closeout.line_pay_received, otherReceived: closeout.other_received, wasteAmount: closeout.waste_amount, notes: closeout.notes, updatedAt: closeout.updated_at } : null };
  }
  saveCloseout(eventId: string, input: { cashReceived: number; linePayReceived: number; otherReceived: number; wasteAmount: number; notes: string; updatedAt: string; operator: string; auditLogId: string }): void {
    this.database.execute(`INSERT INTO operations_event_closeouts (event_id, cash_received, line_pay_received, other_received, waste_amount, notes, updated_at, updated_by, audit_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id) DO UPDATE SET cash_received=excluded.cash_received, line_pay_received=excluded.line_pay_received, other_received=excluded.other_received, waste_amount=excluded.waste_amount, notes=excluded.notes, updated_at=excluded.updated_at, updated_by=excluded.updated_by, audit_log_id=excluded.audit_log_id`, [eventId, input.cashReceived, input.linePayReceived, input.otherReceived, input.wasteAmount, input.notes, input.updatedAt, input.operator, input.auditLogId]);
  }
  unresolvedCount(eventId: string): number { return this.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_orders WHERE event_id = ? AND order_status NOT IN ('completed', 'cancelled')", [eventId])?.count ?? 0; }
  buildReport(event: EventRow, closedAt: string): DailyReport {
    const counts = this.database.queryOne<{ total: number; completed: number; cancelled: number; no_show: number }>(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN order_status = 'cancelled' AND cancellation_reason = 'no_show' THEN 1 ELSE 0 END) AS no_show
      FROM operations_orders WHERE event_id = ?`, [event.event_id]) ?? { total: 0, completed: 0, cancelled: 0, no_show: 0 };
    const products = this.database.queryMany<{ product_id: string; pos_name_snapshot: string; quantity: number; revenue: number }>(`SELECT i.product_id, i.pos_name_snapshot, SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue
      FROM operations_order_items i JOIN operations_orders o ON o.order_id = i.order_id
      WHERE o.event_id = ? AND o.order_status = 'completed' GROUP BY i.product_id, i.pos_name_snapshot ORDER BY i.pos_name_snapshot`, [event.event_id]);
    return { event: { eventId: event.event_id, eventCode: event.event_code, displayName: event.display_name, date: event.date, startTime: event.start_time, endTime: event.end_time }, orders: { total: counts.total, completed: counts.completed ?? 0, cancelled: counts.cancelled ?? 0, noShow: counts.no_show ?? 0 }, products: products.map((item) => ({ productId: item.product_id, posName: item.pos_name_snapshot, quantity: item.quantity, revenue: item.revenue })), payments: { cash: 0, linePay: 0, other: 0 }, closedAt };
  }
  insertClosure(eventId: string, report: DailyReport, timestamp: string, operator: string, auditLogId: string): void { this.database.execute("INSERT INTO operations_event_closures (event_id, closed_at, operator, daily_report_json, audit_log_id) VALUES (?, ?, ?, ?, ?)", [eventId, timestamp, operator, JSON.stringify(report), auditLogId]); }
  closeEvent(eventId: string, timestamp: string): boolean { return this.database.execute("UPDATE operations_events SET status = 'closed', updated_at = ? WHERE event_id = ? AND status = 'open'", [timestamp, eventId]).changes === 1; }
}
