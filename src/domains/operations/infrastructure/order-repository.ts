import { createHash } from "node:crypto";
import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import { createId } from "../../../shared/utils/ids.js";
import type { OperationsOrder, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, PosOrderItemInput, ProductionStatus } from "../domain/types.js";
import { hasNonterminalOrderModification } from "./order-modification-lock.js";

type EventRow = { event_id: string; event_code: string; date: string; start_time: string; end_time: string; status: string };
type EventProductRow = {
  event_id: string; product_id: string; product_version_id: string; planned_quantity: number; reserved_quantity: number; sold_quantity: number;
  display_name: string; pos_name: string; display_category_name: string | null; selling_price: number; channels_json: string; is_active: number;
};
type IdempotencyRow = { request_fingerprint: string; order_id: string };
type OrderRow = {
  order_id: string; order_number: string; event_id: string; source: "pos"; order_status: OrderStatus; payment_status: PaymentStatus;
  production_status: ProductionStatus; cancellation_reason: string | null; scheduled_pickup_at: string | null; customer_name: string | null; customer_phone_tail: string | null; payment_method: PaymentMethod | null; notes: string | null; subtotal: number; discount_total: number;
  grand_total: number; paid_total: number; created_at: string; confirmed_at: string; served_at: string | null;
};
type OrderItemRow = {
  order_item_id: string; product_id: string; product_version_id: string; display_name_snapshot: string; pos_name_snapshot: string;
  display_category_name_snapshot: string | null; unit_list_price: number; unit_selling_price: number; quantity: number;
  line_discount: number; line_total: number; notes: string | null; cost_status: "unavailable";
};

export type OrderProductSnapshot = Readonly<{
  productId: string;
  productVersionId: string;
  displayName: string;
  posName: string;
  displayCategoryName: string | null;
  sellingPrice: number;
}>;

function mapOrder(row: OrderRow, items: readonly OrderItem[]): OperationsOrder {
  const order = {
    orderId: row.order_id, orderNumber: row.order_number, eventId: row.event_id, source: row.source,
    orderStatus: row.order_status, paymentStatus: row.payment_status, productionStatus: row.production_status, cancellationReason: row.cancellation_reason,
    scheduledPickupAt: row.scheduled_pickup_at, customerName: row.customer_name, customerPhoneTail: row.customer_phone_tail, paymentMethod: row.payment_method, notes: row.notes, subtotal: row.subtotal, discountTotal: row.discount_total,
    grandTotal: row.grand_total, paidTotal: row.paid_total, createdAt: row.created_at, confirmedAt: row.confirmed_at, servedAt: row.served_at, items
  };
  const revision = createHash("sha256").update(JSON.stringify(order)).digest("hex");
  return { ...order, revision };
}

function mapItem(row: OrderItemRow): OrderItem {
  return {
    orderItemId: row.order_item_id, productId: row.product_id, productVersionId: row.product_version_id,
    displayNameSnapshot: row.display_name_snapshot, posNameSnapshot: row.pos_name_snapshot, posName: row.pos_name_snapshot,
    displayCategoryNameSnapshot: row.display_category_name_snapshot, unitListPrice: row.unit_list_price,
    unitSellingPrice: row.unit_selling_price, quantity: row.quantity, lineDiscount: row.line_discount,
    lineTotal: row.line_total, notes: row.notes, costStatus: row.cost_status
  };
}

export class OrderRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  transactionImmediate<T>(work: () => T): T { return this.database.transactionImmediate(work); }

  hasNonterminalModification(orderId: string): boolean { return hasNonterminalOrderModification(this.database, orderId); }

  findIdempotency(eventId: string, source: string, idempotencyKey: string): IdempotencyRow | undefined {
    return this.database.queryOne<IdempotencyRow>("SELECT request_fingerprint, order_id FROM operations_order_idempotency WHERE event_id = ? AND source = ? AND idempotency_key = ?", [eventId, source, idempotencyKey]);
  }

  findEvent(eventId: string): EventRow | undefined {
    return this.database.queryOne<EventRow>("SELECT event_id, event_code, date, start_time, end_time, status FROM operations_events WHERE event_id = ?", [eventId]);
  }

  findProduct(eventId: string, productId: string): EventProductRow | undefined {
    return this.database.queryOne<EventProductRow>(`SELECT i.event_id, i.product_id, i.product_version_id, i.planned_quantity, i.reserved_quantity, i.sold_quantity,
      p.display_name, p.pos_name, p.display_category_name, p.selling_price, p.channels_json, p.is_active
      FROM operations_sellable_inventory i
      JOIN operations_product_copies p ON p.product_version_id = i.product_version_id
      WHERE i.event_id = ? AND i.product_id = ? AND i.is_enabled = 1`, [eventId, productId]);
  }

  getProductSnapshot(eventId: string, item: PosOrderItemInput): OrderProductSnapshot | undefined {
    const row = this.findProduct(eventId, item.productId);
    if (!row || row.product_version_id !== item.productVersionId || row.is_active !== 1) return undefined;
    return { productId: row.product_id, productVersionId: row.product_version_id, displayName: row.display_name, posName: row.pos_name, displayCategoryName: row.display_category_name, sellingPrice: row.selling_price };
  }

  isProductVersionInEvent(eventId: string, productId: string, productVersionId: string): boolean {
    return this.database.queryOne<{ product_version_id: string }>("SELECT product_version_id FROM operations_sellable_inventory WHERE event_id = ? AND product_id = ? AND product_version_id = ?", [eventId, productId, productVersionId]) !== undefined;
  }

  decrementRemaining(eventId: string, item: PosOrderItemInput, timestamp: string): boolean {
    const result = this.database.execute(`UPDATE operations_sellable_inventory
      SET sold_quantity = sold_quantity + ?, updated_at = ?
      WHERE event_id = ? AND product_id = ? AND product_version_id = ? AND is_enabled = 1
        AND planned_quantity - reserved_quantity - sold_quantity >= ?`,
      [item.quantity, timestamp, eventId, item.productId, item.productVersionId, item.quantity]);
    return result.changes === 1;
  }

  adjustSoldQuantity(eventId: string, productId: string, productVersionId: string, delta: number, timestamp: string): boolean {
    if (delta === 0) return true;
    if (delta > 0) {
      return this.database.execute(`UPDATE operations_sellable_inventory
        SET sold_quantity = sold_quantity + ?, updated_at = ?
        WHERE event_id = ? AND product_id = ? AND product_version_id = ? AND is_enabled = 1
          AND planned_quantity - reserved_quantity - sold_quantity >= ?`,
      [delta, timestamp, eventId, productId, productVersionId, delta]).changes === 1;
    }
    const release = Math.abs(delta);
    return this.database.execute(`UPDATE operations_sellable_inventory
      SET sold_quantity = sold_quantity - ?, updated_at = ?
      WHERE event_id = ? AND product_id = ? AND product_version_id = ? AND sold_quantity >= ?`,
    [release, timestamp, eventId, productId, productVersionId, release]).changes === 1;
  }

  nextOrderSequence(eventId: string, timestamp: string): number {
    this.database.execute("INSERT OR IGNORE INTO operations_event_order_sequences (event_id, next_sequence, updated_at) VALUES (?, 1, ?)", [eventId, timestamp]);
    const row = this.database.queryOne<{ next_sequence: number }>("SELECT next_sequence FROM operations_event_order_sequences WHERE event_id = ?", [eventId]);
    const sequence = row?.next_sequence;
    if (!sequence) throw new Error("Order sequence could not be allocated.");
    this.database.execute("UPDATE operations_event_order_sequences SET next_sequence = ?, updated_at = ? WHERE event_id = ?", [sequence + 1, timestamp, eventId]);
    return sequence;
  }

  insertOrder(input: { orderId: string; eventId: string; orderNumber: string; idempotencyKey: string; fingerprint: string; scheduledPickupAt: string | null; customerName: string | null; customerPhoneTail: string | null; paymentMethod: PaymentMethod | null; paymentStatus: "unpaid" | "paid"; paidTotal: number; notes: string | null; subtotal: number; createdAt: string }): void {
    this.database.execute(`INSERT INTO operations_orders (order_id, event_id, channel, status, subtotal, discount_total, grand_total, paid_total, idempotency_key, created_at,
      order_number, source, order_status, payment_status, production_status, scheduled_pickup_at, customer_name, customer_phone_tail, payment_method, notes, request_fingerprint, confirmed_at)
      VALUES (?, ?, 'pos', 'confirmed', ?, 0, ?, ?, ?, ?, ?, 'pos', 'confirmed', ?, 'not_started', ?, ?, ?, ?, ?, ?, ?)`,
      [input.orderId, input.eventId, input.subtotal, input.subtotal, input.paidTotal, `${input.eventId}:pos:${input.idempotencyKey}`, input.createdAt, input.orderNumber, input.paymentStatus, input.scheduledPickupAt, input.customerName, input.customerPhoneTail, input.paymentMethod, input.notes, input.fingerprint, input.createdAt]);
  }

  insertOrderItem(input: { orderItemId: string; orderId: string; item: PosOrderItemInput; snapshot: OrderProductSnapshot; createdAt: string }): void {
    const lineTotal = input.snapshot.sellingPrice * input.item.quantity;
    this.database.execute(`INSERT INTO operations_order_items (order_item_id, order_id, product_id, product_version_id, display_name_snapshot, quantity, unit_price, discount_amount, line_total,
      pos_name_snapshot, display_category_name_snapshot, unit_list_price, unit_selling_price, line_discount, notes, cost_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, 'unavailable', ?)`,
      [input.orderItemId, input.orderId, input.item.productId, input.item.productVersionId, input.snapshot.displayName, input.item.quantity, input.snapshot.sellingPrice, lineTotal,
        input.snapshot.posName, input.snapshot.displayCategoryName, input.snapshot.sellingPrice, input.snapshot.sellingPrice, input.item.notes, input.createdAt]);
  }

  insertIdempotency(eventId: string, idempotencyKey: string, fingerprint: string, orderId: string, createdAt: string): void {
    this.database.execute("INSERT INTO operations_order_idempotency (event_id, source, idempotency_key, request_fingerprint, order_id, created_at) VALUES (?, 'pos', ?, ?, ?, ?)", [eventId, idempotencyKey, fingerprint, orderId, createdAt]);
  }

  insertAudit(orderId: string, eventId: string, orderNumber: string, itemCount: number, grandTotal: number, scheduledPickupAt: string | null, occurredAt: string): void {
    const metadata = JSON.stringify({ actor: "local-pos", source: "pos", eventId, orderNumber, itemCount, grandTotal, scheduledPickupAt });
    this.database.execute("INSERT INTO audit_logs (audit_log_id, actor_user_id, entity_type, entity_id, action, before_json, after_json, occurred_at) VALUES (?, NULL, 'order', ?, 'order_created', NULL, ?, ?)", [`audit_${orderId}`, orderId, metadata, occurredAt]);
  }

  getOrder(orderId: string): OperationsOrder | undefined {
    const order = this.database.queryOne<OrderRow>(`SELECT order_id, order_number, event_id, source, order_status, payment_status, production_status, cancellation_reason, scheduled_pickup_at, customer_name, customer_phone_tail, payment_method, notes,
      subtotal, discount_total, grand_total, paid_total, created_at, confirmed_at, served_at FROM operations_orders WHERE order_id = ?`, [orderId]);
    if (!order) return undefined;
    const items = this.database.queryMany<OrderItemRow>(`SELECT order_item_id, product_id, product_version_id, display_name_snapshot, pos_name_snapshot, display_category_name_snapshot,
      unit_list_price, unit_selling_price, quantity, line_discount, line_total, notes, cost_status FROM operations_order_items WHERE order_id = ? ORDER BY rowid`, [orderId]).map(mapItem);
    return mapOrder(order, items);
  }

  listEventOrders(eventId: string): OperationsOrder[] {
    const rows = this.database.queryMany<OrderRow>(`SELECT order_id, order_number, event_id, source, order_status, payment_status, production_status, cancellation_reason, scheduled_pickup_at, customer_name, customer_phone_tail, payment_method, notes,
      subtotal, discount_total, grand_total, paid_total, created_at, confirmed_at, served_at FROM operations_orders
      WHERE event_id = ? AND order_id NOT IN (SELECT superseded_order_id FROM operations_order_replacements)
      ORDER BY COALESCE(scheduled_pickup_at, created_at), order_number`, [eventId]);
    return rows.map((row) => {
      const items = this.database.queryMany<OrderItemRow>(`SELECT order_item_id, product_id, product_version_id, display_name_snapshot, pos_name_snapshot, display_category_name_snapshot,
        unit_list_price, unit_selling_price, quantity, line_discount, line_total, notes, cost_status FROM operations_order_items WHERE order_id = ? ORDER BY rowid`, [row.order_id]).map(mapItem);
      return mapOrder(row, items);
    });
  }

  updateReservationHeader(orderId: string, input: { scheduledPickupAt: string; customerName: string | null; customerPhoneTail: string | null; paymentMethod: PaymentMethod; notes: string | null; subtotal: number }): boolean {
    return this.database.execute(`UPDATE operations_orders
      SET scheduled_pickup_at = ?, customer_name = ?, customer_phone_tail = ?, payment_method = ?, notes = ?, subtotal = ?, grand_total = ?
      WHERE order_id = ? AND order_status = 'confirmed' AND payment_status = 'unpaid' AND scheduled_pickup_at IS NOT NULL`,
    [input.scheduledPickupAt, input.customerName, input.customerPhoneTail, input.paymentMethod, input.notes, input.subtotal, input.subtotal, orderId]).changes === 1;
  }

  replaceOrderItems(orderId: string, entries: readonly { item: PosOrderItemInput; snapshot: OrderProductSnapshot }[], createdAt: string): void {
    this.database.execute("DELETE FROM operations_order_items WHERE order_id = ?", [orderId]);
    for (const entry of entries) this.insertOrderItem({ orderItemId: createId("order_item_"), orderId, item: entry.item, snapshot: entry.snapshot, createdAt });
  }

  insertReservationRevisionAudit(input: { orderId: string; operator: string; deviceId: string; before: OperationsOrder; after: OperationsOrder; occurredAt: string }): void {
    this.database.execute("INSERT INTO audit_logs (audit_log_id, actor_user_id, entity_type, entity_id, action, before_json, after_json, occurred_at) VALUES (?, NULL, 'order', ?, 'order.reservation_updated', ?, ?, ?)", [
      `audit_${createHash("sha256").update(`${input.orderId}\u0000${input.occurredAt}\u0000${input.after.revision}`).digest("hex").slice(0, 32)}`,
      input.orderId,
      JSON.stringify({ operator: input.operator, deviceId: input.deviceId, order: input.before }),
      JSON.stringify({ operator: input.operator, deviceId: input.deviceId, order: input.after }),
      input.occurredAt
    ]);
  }

  getInventoryState(eventId: string, productVersionId: string): { soldQuantity: number; remainingQuantity: number } | undefined {
    const row = this.database.queryOne<{ sold_quantity: number; planned_quantity: number; reserved_quantity: number }>("SELECT sold_quantity, planned_quantity, reserved_quantity FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [eventId, productVersionId]);
    return row ? { soldQuantity: row.sold_quantity, remainingQuantity: row.planned_quantity - row.reserved_quantity - row.sold_quantity } : undefined;
  }
}
