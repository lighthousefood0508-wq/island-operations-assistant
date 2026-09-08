import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { PaymentLedgerProjection, PaymentMethodAmounts } from "../domain/types.js";
import { resolveOrderModificationRoot } from "./order-modification-lock.js";

type OriginalRow = Readonly<{ cash: number; line_pay: number }>;
type AdjustmentRow = Readonly<{
  supplement_cash: number;
  supplement_line_pay: number;
  refund_cash: number;
  refund_line_pay: number;
  inconsistent: number;
}>;

function nonnegativeAmount(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Payment ledger ${field} is invalid.`);
  }
  return value;
}

function amounts(cash: number, linePay: number, field: string): PaymentMethodAmounts {
  const normalizedCash = nonnegativeAmount(cash, `${field}.cash`);
  const normalizedLinePay = nonnegativeAmount(linePay, `${field}.linePay`);
  const total = normalizedCash + normalizedLinePay;
  if (!Number.isSafeInteger(total)) throw new Error(`Payment ledger ${field}.total is invalid.`);
  return { cash: normalizedCash, linePay: normalizedLinePay, total };
}

function project(original: OriginalRow, adjustments: AdjustmentRow): PaymentLedgerProjection {
  if (adjustments.inconsistent !== 0) {
    throw new Error("Payment adjustment evidence is not attached to a confirmed intent.");
  }
  const originalAmounts = amounts(original.cash, original.line_pay, "original");
  const supplements = amounts(adjustments.supplement_cash, adjustments.supplement_line_pay, "supplements");
  const refunds = amounts(adjustments.refund_cash, adjustments.refund_line_pay, "refunds");
  const netCash = originalAmounts.cash + supplements.cash - refunds.cash;
  const netLinePay = originalAmounts.linePay + supplements.linePay - refunds.linePay;
  const net = amounts(netCash, netLinePay, "net");
  return { original: originalAmounts, supplements, refunds, net };
}

function adjustmentProjection(database: DatabaseAdapter, whereSql: string, parameter: string): AdjustmentRow {
  return database.queryOne<AdjustmentRow>(`SELECT
    COALESCE(SUM(CASE WHEN a.direction = 'supplement' AND a.payment_method = 'CASH' THEN a.amount ELSE 0 END), 0) AS supplement_cash,
    COALESCE(SUM(CASE WHEN a.direction = 'supplement' AND a.payment_method = 'LINE_PAY' THEN a.amount ELSE 0 END), 0) AS supplement_line_pay,
    COALESCE(SUM(CASE WHEN a.direction = 'refund' AND a.payment_method = 'CASH' THEN a.amount ELSE 0 END), 0) AS refund_cash,
    COALESCE(SUM(CASE WHEN a.direction = 'refund' AND a.payment_method = 'LINE_PAY' THEN a.amount ELSE 0 END), 0) AS refund_line_pay,
    COALESCE(SUM(CASE WHEN i.state != 'confirmed' THEN 1 ELSE 0 END), 0) AS inconsistent
    FROM operations_payment_adjustments a
    JOIN operations_order_modification_intents i ON i.intent_id = a.intent_id
    WHERE ${whereSql}`, [parameter]) ?? {
      supplement_cash: 0,
      supplement_line_pay: 0,
      refund_cash: 0,
      refund_line_pay: 0,
      inconsistent: 0
    };
}

export function readEventPaymentLedger(database: DatabaseAdapter, eventId: string): PaymentLedgerProjection {
  const original = database.queryOne<OriginalRow>(`SELECT
    COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' AND p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS cash,
    COALESCE(SUM(CASE WHEN p.payment_method = 'LINE_PAY' AND p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS line_pay
    FROM operations_payments p
    JOIN operations_orders o ON o.order_id = p.order_id
    WHERE o.event_id = ?`, [eventId]) ?? { cash: 0, line_pay: 0 };
  return project(original, adjustmentProjection(database, "i.event_id = ?", eventId));
}

export function readOrderChainPaymentLedger(database: DatabaseAdapter, orderId: string): PaymentLedgerProjection {
  const rootOrderId = resolveOrderModificationRoot(database, orderId);
  const original = database.queryOne<OriginalRow>(`SELECT
    COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' AND p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS cash,
    COALESCE(SUM(CASE WHEN p.payment_method = 'LINE_PAY' AND p.payment_status = 'paid' THEN p.amount ELSE 0 END), 0) AS line_pay
    FROM operations_payments p
    JOIN operations_orders o ON o.order_id = p.order_id
    WHERE (o.order_id = ? OR o.order_id IN (
      SELECT superseded_order_id FROM operations_order_replacements WHERE root_order_id = ?
      UNION SELECT replacement_order_id FROM operations_order_replacements WHERE root_order_id = ?
    ))`, [rootOrderId, rootOrderId, rootOrderId]) ?? { cash: 0, line_pay: 0 };
  return project(original, adjustmentProjection(database, "a.root_order_id = ?", rootOrderId));
}
