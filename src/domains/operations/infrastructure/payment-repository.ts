import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { OperationsOrder, OperationsPayment, PaymentMethod } from "../domain/types.js";
import { OrderRepository } from "./order-repository.js";

type PaymentRow = {
  payment_id: string;
  order_id: string;
  payment_method: PaymentMethod;
  payment_status: string;
  amount: number;
  paid_at: string;
  operator: string | null;
  device_id: string | null;
  identity_trust: string | null;
  request_fingerprint: string | null;
};

type EventRow = { status: string };

function mapPayment(row: PaymentRow): OperationsPayment {
  return {
    paymentId: row.payment_id,
    orderId: row.order_id,
    paymentMethod: row.payment_method,
    paymentStatus: "paid",
    amount: row.amount,
    paidAt: row.paid_at,
    operator: row.operator ?? "unknown",
    deviceId: row.device_id ?? "unknown",
    identityTrust: "client_reported"
  };
}

export class PaymentRepository {
  private readonly orders: OrderRepository;

  constructor(private readonly database: DatabaseAdapter) {
    this.orders = new OrderRepository(database);
  }

  transactionImmediate<T>(work: () => T): T {
    return this.database.transactionImmediate(work);
  }

  findOrder(orderId: string): OperationsOrder | undefined {
    return this.orders.getOrder(orderId);
  }

  findEventStatus(eventId: string): string | undefined {
    return this.database.queryOne<EventRow>("SELECT status FROM operations_events WHERE event_id = ?", [eventId])?.status;
  }

  findByIdempotencyKey(idempotencyKey: string): { payment: OperationsPayment; fingerprint: string } | undefined {
    const row = this.database.queryOne<PaymentRow>("SELECT payment_id, order_id, payment_method, payment_status, amount, paid_at, operator, device_id, identity_trust, request_fingerprint FROM operations_payments WHERE idempotency_key = ?", [idempotencyKey]);
    return row?.request_fingerprint ? { payment: mapPayment(row), fingerprint: row.request_fingerprint } : undefined;
  }

  insertPayment(input: {
    paymentId: string;
    orderId: string;
    paymentMethod: PaymentMethod;
    amount: number;
    paidAt: string;
    idempotencyKey: string;
    requestFingerprint: string;
    operator: string;
    deviceId: string;
    auditLogId: string;
  }): OperationsPayment {
    this.database.execute(`INSERT INTO operations_payments
      (payment_id, order_id, payment_method, payment_status, amount, external_reference, paid_at,
       idempotency_key, request_fingerprint, operator, device_id, identity_trust, audit_log_id)
      VALUES (?, ?, ?, 'paid', ?, NULL, ?, ?, ?, ?, ?, 'client_reported', ?)`,
    [input.paymentId, input.orderId, input.paymentMethod, input.amount, input.paidAt,
      input.idempotencyKey, input.requestFingerprint, input.operator, input.deviceId, input.auditLogId]);
    return {
      paymentId: input.paymentId,
      orderId: input.orderId,
      paymentMethod: input.paymentMethod,
      paymentStatus: "paid",
      amount: input.amount,
      paidAt: input.paidAt,
      operator: input.operator,
      deviceId: input.deviceId,
      identityTrust: "client_reported"
    };
  }

  confirmServedOrderPayment(orderId: string, paymentMethod: PaymentMethod, expectedAmount: number, timestamp: string): boolean {
    return this.database.execute(`UPDATE operations_orders
      SET payment_status = 'paid', paid_total = grand_total, payment_method = ?,
          order_status = 'completed', status = 'completed', completed_at = ?
      WHERE order_id = ? AND order_status = 'confirmed' AND payment_status = 'unpaid'
        AND production_status = 'served' AND grand_total = ?`,
    [paymentMethod, timestamp, orderId, expectedAmount]).changes === 1;
  }

  insertAudit(input: { auditLogId: string; entityId: string; action: string; metadata: Record<string, unknown>; occurredAt: string }): void {
    this.database.execute("INSERT INTO audit_logs (audit_log_id, actor_user_id, entity_type, entity_id, action, before_json, after_json, occurred_at) VALUES (?, NULL, 'order', ?, ?, NULL, ?, ?)",
      [input.auditLogId, input.entityId, input.action, JSON.stringify(input.metadata), input.occurredAt]);
  }
}
