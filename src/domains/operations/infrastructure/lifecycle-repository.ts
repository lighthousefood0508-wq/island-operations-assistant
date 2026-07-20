import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { DailyReport, OrderStatus } from "../domain/types.js";

type OrderRow = { order_id: string; order_number: string; event_id: string; order_status: OrderStatus; grand_total: number };
type EventRow = { event_id: string; event_code: string; display_name: string; date: string; start_time: string; end_time: string; status: string };
type ClosureRow = { daily_report_json: string };

export type LifecycleOrder = Readonly<{ orderId: string; orderNumber: string; eventId: string; orderStatus: OrderStatus; grandTotal: number }>;

export class LifecycleRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  transactionImmediate<T>(work: () => T): T { return this.database.transactionImmediate(work); }
  findOrder(orderId: string): LifecycleOrder | undefined {
    const row = this.database.queryOne<OrderRow>("SELECT order_id, order_number, event_id, order_status, grand_total FROM operations_orders WHERE order_id = ?", [orderId]);
    return row && { orderId: row.order_id, orderNumber: row.order_number, eventId: row.event_id, orderStatus: row.order_status, grandTotal: row.grand_total };
  }
  listEventOrders(eventId: string): LifecycleOrder[] {
    return this.database.queryMany<OrderRow>("SELECT order_id, order_number, event_id, order_status, grand_total FROM operations_orders WHERE event_id = ? ORDER BY created_at, order_number", [eventId]).map((row) => ({ orderId: row.order_id, orderNumber: row.order_number, eventId: row.event_id, orderStatus: row.order_status, grandTotal: row.grand_total }));
  }
  updateStatus(orderId: string, from: OrderStatus, to: OrderStatus, timestamp: string): boolean {
    return this.database.execute("UPDATE operations_orders SET order_status = ?, status = ?, completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END WHERE order_id = ? AND order_status = ?", [to, to, to, timestamp, orderId, from]).changes === 1;
  }
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
  unresolvedCount(eventId: string): number { return this.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_orders WHERE event_id = ? AND order_status IN ('pending', 'cooking', 'ready')", [eventId])?.count ?? 0; }
  buildReport(event: EventRow, closedAt: string): DailyReport {
    const counts = this.database.queryOne<{ total: number; completed: number; cancelled: number; no_show: number }>(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN order_status = 'no_show' THEN 1 ELSE 0 END) AS no_show
      FROM operations_orders WHERE event_id = ?`, [event.event_id]) ?? { total: 0, completed: 0, cancelled: 0, no_show: 0 };
    const products = this.database.queryMany<{ product_id: string; pos_name_snapshot: string; quantity: number; revenue: number }>(`SELECT i.product_id, i.pos_name_snapshot, SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue
      FROM operations_order_items i JOIN operations_orders o ON o.order_id = i.order_id
      WHERE o.event_id = ? AND o.order_status = 'completed' GROUP BY i.product_id, i.pos_name_snapshot ORDER BY i.pos_name_snapshot`, [event.event_id]);
    return { event: { eventId: event.event_id, eventCode: event.event_code, displayName: event.display_name, date: event.date, startTime: event.start_time, endTime: event.end_time }, orders: { total: counts.total, completed: counts.completed ?? 0, cancelled: counts.cancelled ?? 0, noShow: counts.no_show ?? 0 }, products: products.map((item) => ({ productId: item.product_id, posName: item.pos_name_snapshot, quantity: item.quantity, revenue: item.revenue })), payments: { cash: 0, linePay: 0, other: 0 }, closedAt };
  }
  insertClosure(eventId: string, report: DailyReport, timestamp: string, operator: string, auditLogId: string): void { this.database.execute("INSERT INTO operations_event_closures (event_id, closed_at, operator, daily_report_json, audit_log_id) VALUES (?, ?, ?, ?, ?)", [eventId, timestamp, operator, JSON.stringify(report), auditLogId]); }
  closeEvent(eventId: string, timestamp: string): boolean { return this.database.execute("UPDATE operations_events SET status = 'closed', updated_at = ? WHERE event_id = ? AND status = 'open'", [timestamp, eventId]).changes === 1; }
}
