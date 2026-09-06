import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { LifecycleRepository } from "../domains/operations/infrastructure/lifecycle-repository.js";
import { OperationsService } from "../domains/operations/application/operations-service.js";
import { OrderModificationService } from "../domains/operations/application/order-modification-service.js";
import { OrderService } from "../domains/operations/application/order-service.js";
import { OperationsRepository } from "../domains/operations/infrastructure/operations-repository.js";
import { OrderModificationRepository } from "../domains/operations/infrastructure/order-modification-repository.js";
import { OrderRepository } from "../domains/operations/infrastructure/order-repository.js";
import { PaymentRepository } from "../domains/operations/infrastructure/payment-repository.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const meal = { contractVersion: "2" as const, productId: "prod_meal", productVersionId: "pver_meal", categoryId: "cat_meal", displayCategoryName: "主餐", displayCategorySortOrder: 1, displayName: "東坡肉", posName: "東坡", sellingPrice: 100, channels: ["pos"], isActive: true, publishedAt: "2026-09-05T00:00:00.000Z" };
const drink = { contractVersion: "2" as const, productId: "prod_drink", productVersionId: "pver_drink", categoryId: "cat_drink", displayCategoryName: "飲料", displayCategorySortOrder: 2, displayName: "紅茶", posName: "紅茶", sellingPrice: 40, channels: ["pos"], isActive: true, publishedAt: "2026-09-05T00:00:00.000Z" };

function fixture() {
  const databasePath = path.resolve("data", `order-modification-payment-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  const operations = new OperationsService(new OperationsRepository(database));
  const paymentRepository = new PaymentRepository(database);
  const orders = new OrderService(new OrderRepository(database), paymentRepository);
  const event = operations.createEvent({ eventCode: "PAYMOD", displayName: "付款改單", date: "2026-09-05", startTime: "10:00", endTime: "22:00" });
  operations.setSellableInventory(event.eventId, meal, { plannedQuantity: 20 });
  operations.setSellableInventory(event.eventId, drink, { plannedQuantity: 20 });
  operations.openEvent(event.eventId);
  const repository = new OrderModificationRepository(database);
  const modifications = new OrderModificationService(repository, () => new Date("2026-09-05T05:00:00.000Z"));
  return { database, databasePath, event, orders, repository, modifications };
}

function cleanup(value: ReturnType<typeof fixture>): void {
  value.database.close();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${value.databasePath}${suffix}`, { force: true });
}

function createOrder(value: ReturnType<typeof fixture>, input: { key: string; quantity?: number; paid?: boolean; method?: "CASH" | "LINE_PAY" }) {
  return value.orders.createPosOrder({
    source: "pos",
    eventId: value.event.eventId,
    idempotencyKey: input.key,
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: input.quantity ?? 1, notes: null }],
    scheduledPickupAt: null,
    paymentCollected: input.paid ?? false,
    customerName: "Miles",
    customerPhoneTail: "123",
    paymentMethod: input.method ?? "CASH",
    operator: "Owner",
    deviceId: "POS-A",
    notes: null
  }).order;
}

function prepare(value: ReturnType<typeof fixture>, order: ReturnType<typeof createOrder>, input: {
  key: string;
  quantity: number;
  supplementMethod?: "CASH" | "LINE_PAY" | null;
  returned?: number;
  notReturned?: number;
  notes?: string | null;
}) {
  const removed = Math.max(0, order.items[0]!.quantity - input.quantity);
  return value.modifications.prepare({
    orderId: order.orderId,
    expectedRevision: order.revision,
    idempotencyKey: input.key,
    items: input.quantity > 0 ? [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: input.quantity, notes: null }] : [],
    scheduledPickupAt: null,
    customerName: order.customerName,
    customerPhoneTail: order.customerPhoneTail,
    paymentMethod: order.paymentMethod,
    notes: input.notes ?? order.notes,
    supplementMethod: input.supplementMethod ?? null,
    dispositions: removed > 0 ? [{
      orderItemId: order.items[0]!.orderItemId,
      returnedToSellableQuantity: input.returned ?? removed,
      notReturnedQuantity: input.notReturned ?? 0,
      reason: "客人修改餐點"
    }] : [],
    actor: "Owner",
    deviceId: "POS-A"
  });
}

function confirmInput(intent: ReturnType<typeof prepare>["intent"], evidence: Record<string, unknown> | null) {
  return {
    expectedRevision: intent.intentRevision,
    idempotencyKey: intent.idempotencyKey,
    actor: "Owner",
    deviceId: "POS-B",
    evidence
  };
}

test("unpaid no-external replacement confirms atomically and replays without duplicate rows", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "unpaid-root" });
    const prepared = prepare(value, original, { key: "unpaid-change", quantity: 2 });
    const confirmed = value.modifications.confirm(prepared.intent.intentId, confirmInput(prepared.intent, null));
    assert.equal(confirmed.replayed, false);
    assert.equal(confirmed.intent.state, "confirmed");
    assert.ok(confirmed.replacement);
    assert.equal(confirmed.paymentAdjustment, null);
    assert.equal(confirmed.effectiveOrder.paymentStatus, "unpaid");
    assert.equal(confirmed.effectiveOrder.grandTotal, 200);
    assert.equal(value.orders.listEventOrders(value.event.eventId).length, 1);
    assert.equal(value.orders.listEventOrders(value.event.eventId)[0]!.orderId, confirmed.effectiveOrder.orderId);
    assert.deepEqual(value.database.queryOne<{ sold: number; reserved: number }>("SELECT sold_quantity AS sold, reserved_quantity AS reserved FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [value.event.eventId, meal.productVersionId]), { sold: 2, reserved: 0 });

    const replay = value.modifications.confirm(prepared.intent.intentId, confirmInput(confirmed.intent, null));
    assert.equal(replay.replayed, true);
    assert.equal(replay.effectiveOrder.orderId, confirmed.effectiveOrder.orderId);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 1);
  } finally {
    cleanup(value);
  }
});

test("paid supplement persists one immutable Cash adjustment and closeout uses net receipts", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "paid-cash-root", paid: true, method: "CASH" });
    const prepared = prepare(value, original, { key: "paid-cash-change", quantity: 2, supplementMethod: "CASH" });
    assert.equal(prepared.intent.adjustmentAmount, 100);
    const external = value.modifications.beginExternalAction(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
    const evidence = { kind: "cash", direction: "supplement", paymentMethod: "CASH", amount: 100, attested: true };
    const confirmed = value.modifications.confirm(external.intentId, confirmInput(external, evidence));
    assert.equal(confirmed.paymentAdjustment?.direction, "supplement");
    assert.equal(confirmed.paymentAdjustment?.amount, 100);
    assert.equal(confirmed.paymentAdjustment?.externalReference, null);
    assert.equal(confirmed.effectiveOrder.paymentStatus, "paid");
    assert.equal(confirmed.effectiveOrder.paidTotal, 200);
    const statistics = new LifecycleRepository(value.database).getStatistics(value.event.eventId) as { receivedAmount: number; cashReceivedAmount: number };
    assert.equal(statistics.receivedAmount, 200);
    assert.equal(statistics.cashReceivedAmount, 200);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payments")?.count, 1);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 1);
    const replay = value.modifications.confirm(external.intentId, confirmInput(confirmed.intent, evidence));
    assert.equal(replay.replayed, true);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 1);
  } finally {
    cleanup(value);
  }
});

test("paid LINE Pay refund returns only the chosen quantity and freezes disposition evidence", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "paid-line-root", quantity: 3, paid: true, method: "LINE_PAY" });
    const prepared = prepare(value, original, { key: "paid-line-refund", quantity: 1, returned: 1, notReturned: 1 });
    assert.equal(prepared.intent.adjustmentDirection, "refund");
    assert.equal(prepared.intent.adjustmentAmount, 200);
    const external = value.modifications.beginExternalAction(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
    const evidence = { kind: "line_pay", direction: "refund", paymentMethod: "LINE_PAY", amount: 200, externalReference: "line-refund-001" };
    const confirmed = value.modifications.confirm(external.intentId, confirmInput(external, evidence));
    assert.equal(confirmed.dispositions.length, 1);
    assert.equal(confirmed.dispositions[0]!.returnedToSellableQuantity, 1);
    assert.equal(confirmed.dispositions[0]!.notReturnedQuantity, 1);
    assert.deepEqual(value.database.queryOne<{ sold: number; reserved: number }>("SELECT sold_quantity AS sold, reserved_quantity AS reserved FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [value.event.eventId, meal.productVersionId]), { sold: 2, reserved: 0 });
    const statistics = new LifecycleRepository(value.database).getStatistics(value.event.eventId) as { receivedAmount: number; linePayReceivedAmount: number };
    assert.equal(statistics.receivedAmount, 100);
    assert.equal(statistics.linePayReceivedAmount, 100);
    assert.throws(() => value.database.execute("UPDATE operations_order_item_dispositions SET not_returned_quantity = 0 WHERE intent_id = ?", [external.intentId]));
  } finally {
    cleanup(value);
  }
});

test("Phase B failure enters durable reconciliation and another connection resumes the same intent once", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "failure-root", paid: true, method: "CASH" });
    const prepared = prepare(value, original, { key: "failure-change", quantity: 2, supplementMethod: "CASH" });
    const external = value.modifications.beginExternalAction(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
    const evidence = { kind: "cash", direction: "supplement", paymentMethod: "CASH", amount: 100, attested: true };
    const originalInsert = value.repository.insertReplacementOrder.bind(value.repository);
    value.repository.insertReplacementOrder = () => { throw new Error("simulated Phase B interruption"); };
    assert.throws(() => value.modifications.confirm(external.intentId, confirmInput(external, evidence)), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_RECONCILIATION_REQUIRED");
    value.repository.insertReplacementOrder = originalInsert;
    const recovery = value.modifications.getRecovery(external.intentId);
    assert.equal(recovery.intent.state, "reconciliation_required");
    assert.equal(recovery.heldReservations[0]?.quantity, 1);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 0);

    const secondDatabase = createDatabase({ host: "127.0.0.1", port: 0, databasePath: value.databasePath });
    try {
      const second = new OrderModificationService(new OrderModificationRepository(secondDatabase), () => new Date("2026-09-05T05:05:00.000Z"));
      const resumed = second.confirm(recovery.intent.intentId, confirmInput(recovery.intent, evidence));
      assert.equal(resumed.intent.state, "confirmed");
      assert.equal(secondDatabase.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 1);
      assert.equal(secondDatabase.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 1);
    } finally {
      secondDatabase.close();
    }
  } finally {
    cleanup(value);
  }
});

test("verified no-money recovery is method-specific and releases held quantity without replacement", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "cancel-root", paid: true, method: "LINE_PAY" });
    const prepared = prepare(value, original, { key: "cancel-change", quantity: 2, supplementMethod: "LINE_PAY" });
    const external = value.modifications.beginExternalAction(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
    const baseCommand = { expectedRevision: external.intentRevision, idempotencyKey: external.idempotencyKey, actor: "Admin", deviceId: "POS-C", reason: "LINE Pay 顯示未完成" };
    assert.throws(() => value.modifications.cancelAfterVerifiedNoMoney(external.intentId, { ...baseCommand, verification: { kind: "cash", confirmedNoMoney: true } }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_NO_MONEY_EVIDENCE_MISMATCH");
    const cancelled = value.modifications.cancelAfterVerifiedNoMoney(external.intentId, { ...baseCommand, verification: { kind: "line_pay", verified: true, externalStatus: "not_completed", externalReference: "line-attempt-void" } });
    assert.equal(cancelled.state, "cancelled");
    assert.equal(value.database.queryOne<{ total: number }>("SELECT COALESCE(SUM(reserved_quantity), 0) AS total FROM operations_sellable_inventory WHERE event_id = ?", [value.event.eventId])?.total, 0);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 0);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 0);
  } finally {
    cleanup(value);
  }
});

test("whole-order cancellation creates refund and immutable dispositions but no empty replacement", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "whole-root", quantity: 2, paid: true, method: "CASH" });
    const prepared = prepare(value, original, { key: "whole-cancel", quantity: 0, returned: 0, notReturned: 2 });
    assert.equal(prepared.intent.outcomeKind, "cancellation");
    const external = value.modifications.beginExternalAction(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
    const confirmed = value.modifications.confirm(external.intentId, confirmInput(external, { kind: "cash", direction: "refund", paymentMethod: "CASH", amount: 200, attested: true }));
    assert.equal(confirmed.replacement, null);
    assert.equal(confirmed.effectiveOrder.orderStatus, "cancelled");
    assert.equal(confirmed.effectiveOrder.paymentStatus, "refunded");
    assert.equal(confirmed.dispositions[0]?.notReturnedQuantity, 2);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 0);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_orders")?.count, 1);
  } finally {
    cleanup(value);
  }
});

test("LINE Pay external reference reuse and frozen evidence mismatch fail closed in reconciliation", () => {
  const value = fixture();
  try {
    const first = createOrder(value, { key: "line-reference-root-1", paid: true, method: "LINE_PAY" });
    const firstPrepared = prepare(value, first, { key: "line-reference-change-1", quantity: 2, supplementMethod: "LINE_PAY" });
    const firstExternal = value.modifications.beginExternalAction(firstPrepared.intent.intentId, firstPrepared.intent.intentRevision, "Owner");
    value.modifications.confirm(firstExternal.intentId, confirmInput(firstExternal, {
      kind: "line_pay",
      direction: "supplement",
      paymentMethod: "LINE_PAY",
      amount: 100,
      externalReference: "line-shared-reference"
    }));

    const second = createOrder(value, { key: "line-reference-root-2", quantity: 2, paid: true, method: "LINE_PAY" });
    const secondPrepared = prepare(value, second, { key: "line-reference-change-2", quantity: 3, supplementMethod: "LINE_PAY" });
    const secondExternal = value.modifications.beginExternalAction(secondPrepared.intent.intentId, secondPrepared.intent.intentRevision, "Owner");
    assert.throws(() => value.modifications.confirm(secondExternal.intentId, confirmInput(secondExternal, {
      kind: "line_pay",
      direction: "supplement",
      paymentMethod: "LINE_PAY",
      amount: 100,
      externalReference: "line-shared-reference"
    })), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_EXTERNAL_REFERENCE_REUSED");
    assert.equal(value.modifications.getRecovery(secondExternal.intentId).intent.state, "reconciliation_required");

    const third = createOrder(value, { key: "line-evidence-root-3", paid: true, method: "CASH" });
    const thirdPrepared = prepare(value, third, { key: "line-evidence-change-3", quantity: 2, supplementMethod: "CASH" });
    const thirdExternal = value.modifications.beginExternalAction(thirdPrepared.intent.intentId, thirdPrepared.intent.intentRevision, "Owner");
    assert.throws(() => value.modifications.confirm(thirdExternal.intentId, confirmInput(thirdExternal, {
      kind: "cash",
      direction: "supplement",
      paymentMethod: "CASH",
      amount: 99,
      attested: true
    })), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_RECONCILIATION_REQUIRED");
    assert.equal(value.modifications.getRecovery(thirdExternal.intentId).intent.state, "reconciliation_required");
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 1);
  } finally {
    cleanup(value);
  }
});

test("ready Order production-note change confirms a preparing replacement", () => {
  const value = fixture();
  try {
    const created = createOrder(value, { key: "ready-note-root" });
    value.database.execute("UPDATE operations_orders SET production_status = 'ready' WHERE order_id = ?", [created.orderId]);
    const ready = value.orders.getOrder(created.orderId);
    assert.equal(ready.productionStatus, "ready");
    const prepared = prepare(value, ready, { key: "ready-note-change", quantity: 1, notes: "不要辣，醬少一點" });
    assert.equal(prepared.intent.productionResetRequired, true);
    const confirmed = value.modifications.confirm(prepared.intent.intentId, confirmInput(prepared.intent, null));
    assert.equal(confirmed.effectiveOrder.productionStatus, "preparing");
    assert.equal(confirmed.effectiveOrder.notes, "不要辣，醬少一點");
  } finally {
    cleanup(value);
  }
});

test("expired no-external prepared intent cannot confirm and leaves zero Phase B writes", () => {
  const value = fixture();
  try {
    const original = createOrder(value, { key: "expired-confirm-root" });
    const prepared = prepare(value, original, { key: "expired-confirm-change", quantity: 2 });
    value.database.execute(
      "UPDATE operations_order_modification_intents SET expires_at = ? WHERE intent_id = ?",
      ["2026-09-05T04:59:59.000Z", prepared.intent.intentId]
    );
    assert.throws(
      () => value.modifications.confirm(prepared.intent.intentId, confirmInput(prepared.intent, null)),
      (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_CONFIRM_CONFLICT"
    );
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 0);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 0);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_item_dispositions")?.count, 0);
    assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_orders")?.count, 1);
    assert.equal(value.modifications.expirePrepared(), 1);
    assert.equal(value.modifications.getIntent(prepared.intent.intentId).state, "expired");
  } finally {
    cleanup(value);
  }
});
