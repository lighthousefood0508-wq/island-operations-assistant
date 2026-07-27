import { createHash } from "node:crypto";
import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import type { ConfirmPaymentResult, PaymentMethod } from "../domain/types.js";
import { PaymentRepository } from "../infrastructure/payment-repository.js";

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "VALIDATION_ERROR", `${field} is required.`, { field });
  const text = value.trim();
  if (text.length > maxLength) throw new HttpError(400, "VALIDATION_ERROR", `${field} is too long.`, { field });
  return text;
}

function paymentMethod(value: unknown): PaymentMethod {
  if (value !== "CASH" && value !== "LINE_PAY") throw new HttpError(400, "VALIDATION_ERROR", "paymentMethod must be CASH or LINE_PAY.", { field: "paymentMethod" });
  return value;
}

function amount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new HttpError(400, "VALIDATION_ERROR", "expectedAmount must be a non-negative integer.", { field: "expectedAmount" });
  return value as number;
}

export class PaymentService {
  constructor(private readonly repository: PaymentRepository) {}

  confirmPayment(orderId: string, input: unknown): ConfirmPaymentResult {
    const value = input as Record<string, unknown>;
    if (value?.confirmed !== true) throw new HttpError(400, "PAYMENT_CONFIRMATION_REQUIRED", "Payment confirmation requires confirmed=true.");
    const method = paymentMethod(value?.paymentMethod);
    const expectedAmount = amount(value?.expectedAmount);
    const idempotencyKey = requiredText(value?.idempotencyKey, "idempotencyKey", 200);
    const operator = requiredText(value?.operator, "operator", 100);
    const deviceId = requiredText(value?.deviceId, "deviceId", 100);
    const fingerprint = createHash("sha256").update(JSON.stringify({ orderId, paymentMethod: method, expectedAmount, operator, deviceId })).digest("hex");

    return this.repository.transactionImmediate(() => {
      const replay = this.repository.findByIdempotencyKey(idempotencyKey);
      if (replay) {
        if (replay.fingerprint !== fingerprint) throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used with different payment data.");
        const order = this.repository.findOrder(orderId);
        if (!order || replay.payment.orderId !== orderId) throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key belongs to another payment.");
        return { order, payment: replay.payment, replayed: true };
      }

      const order = this.repository.findOrder(orderId);
      if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (order.orderStatus === "completed" || order.paymentStatus === "paid") throw new HttpError(409, "PAYMENT_ALREADY_CONFIRMED", "Payment has already been confirmed.");
      if (order.orderStatus === "cancelled" || order.cancellationReason === "no_show") throw new HttpError(409, "ORDER_NOT_PAYABLE", "Cancelled and no-show Orders cannot accept payment.");
      if (order.orderStatus !== "confirmed") throw new HttpError(409, "INVALID_ORDER_STATE", "Only confirmed Orders can accept payment.");
      if (order.productionStatus !== "served") throw new HttpError(409, "ORDER_NOT_SERVED", "Payment confirmation is available after the Order is served.");
      if (order.paymentStatus !== "unpaid") throw new HttpError(409, "INVALID_PAYMENT_STATE", "Only unpaid Orders can confirm payment.");
      if (order.grandTotal !== expectedAmount) throw new HttpError(409, "PAYMENT_AMOUNT_MISMATCH", "The expected amount does not match the authoritative Order total.", { expectedAmount: String(expectedAmount), grandTotal: String(order.grandTotal) });
      const eventStatus = this.repository.findEventStatus(order.eventId);
      if (eventStatus !== "open" && eventStatus !== "paused") throw new HttpError(409, "EVENT_NOT_ACTIVE", "Payment can only be confirmed while the Event is open or paused.");

      const timestamp = new Date().toISOString();
      const paymentId = createId("payment_");
      const auditLogId = createId("audit_");
      if (!this.repository.confirmServedOrderPayment(orderId, method, expectedAmount, timestamp)) {
        throw new HttpError(409, "PAYMENT_CONCURRENTLY_CHANGED", "Payment or Order state changed concurrently.");
      }
      this.repository.insertAudit({
        auditLogId,
        entityId: orderId,
        action: "payment_confirmed",
        metadata: {
          orderId,
          eventId: order.eventId,
          paymentId,
          paymentMethod: method,
          amount: order.grandTotal,
          paidAt: timestamp,
          operator,
          deviceId,
          identityTrust: "client_reported",
          fromPaymentStatus: "unpaid",
          toPaymentStatus: "paid",
          fromOrderStatus: "confirmed",
          toOrderStatus: "completed"
        },
        occurredAt: timestamp
      });
      const payment = this.repository.insertPayment({
        paymentId,
        orderId,
        paymentMethod: method,
        amount: order.grandTotal,
        paidAt: timestamp,
        idempotencyKey,
        requestFingerprint: fingerprint,
        operator,
        deviceId,
        auditLogId
      });
      const updated = this.repository.findOrder(orderId);
      if (!updated) throw new Error("Paid Order could not be reloaded.");
      return { order: updated, payment, replayed: false };
    });
  }
}
