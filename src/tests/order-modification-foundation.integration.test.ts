import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { OrderModificationService } from "../domains/operations/application/order-modification-service.js";
import { LifecycleService } from "../domains/operations/application/lifecycle-service.js";
import { OperationsService } from "../domains/operations/application/operations-service.js";
import { OrderService } from "../domains/operations/application/order-service.js";
import { PaymentService } from "../domains/operations/application/payment-service.js";
import { LifecycleRepository } from "../domains/operations/infrastructure/lifecycle-repository.js";
import { OrderModificationRepository } from "../domains/operations/infrastructure/order-modification-repository.js";
import { OperationsRepository } from "../domains/operations/infrastructure/operations-repository.js";
import { OrderRepository } from "../domains/operations/infrastructure/order-repository.js";
import { PaymentRepository } from "../domains/operations/infrastructure/payment-repository.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const meal = { contractVersion: "2" as const, productId: "prod_meal", productVersionId: "pver_meal", categoryId: "cat_meal", displayCategoryName: "Meal", displayCategorySortOrder: 1, displayName: "Meal", posName: "Meal", sellingPrice: 100, channels: ["pos"], isActive: true, publishedAt: "2026-09-05T00:00:00.000Z" };
const drink = { contractVersion: "2" as const, productId: "prod_drink", productVersionId: "pver_drink", categoryId: "cat_drink", displayCategoryName: "Drink", displayCategorySortOrder: 2, displayName: "Drink", posName: "Drink", sellingPrice: 40, channels: ["pos"], isActive: true, publishedAt: "2026-09-05T00:00:00.000Z" };

function fixture(clock = new Date("2026-09-05T04:00:00.000Z")) {
  const databasePath = path.resolve("data", `order-modification-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  const operations = new OperationsService(new OperationsRepository(database));
  const orders = new OrderService(new OrderRepository(database), new PaymentRepository(database));
  const event = operations.createEvent({ eventCode: "MOD", displayName: "Modification", date: "2026-09-05", startTime: "10:00", endTime: "22:00" });
  operations.setSellableInventory(event.eventId, meal, { plannedQuantity: 5 });
  operations.setSellableInventory(event.eventId, drink, { plannedQuantity: 5 });
  operations.openEvent(event.eventId);
  let currentClock = clock;
  const modifications = new OrderModificationService(new OrderModificationRepository(database), () => currentClock);
  return { database, databasePath, event, orders, modifications, advance(milliseconds: number) { currentClock = new Date(currentClock.getTime() + milliseconds); } };
}

function createScheduled(fixtureValue: ReturnType<typeof fixture>, key = "scheduled") {
  return fixtureValue.orders.createPosOrder({
    source: "pos",
    eventId: fixtureValue.event.eventId,
    idempotencyKey: key,
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 1, notes: null }],
    scheduledPickupAt: "2026-09-05T18:00:00+08:00",
    paymentCollected: false,
    customerName: "Miles",
    customerPhoneTail: "123",
    paymentMethod: "CASH",
    operator: "Owner",
    deviceId: "POS-A",
    notes: null
  }).order;
}

function prepareInput(order: ReturnType<typeof createScheduled>, key = "modify-1") {
  return {
    orderId: order.orderId,
    expectedRevision: order.revision,
    idempotencyKey: key,
    items: [
      { productId: meal.productId, productVersionId: meal.productVersionId, quantity: 2, notes: null },
      { productId: drink.productId, productVersionId: drink.productVersionId, quantity: 1, notes: "no ice" }
    ],
    scheduledPickupAt: order.scheduledPickupAt,
    customerName: order.customerName,
    customerPhoneTail: order.customerPhoneTail,
    paymentMethod: order.paymentMethod,
    notes: order.notes,
    supplementMethod: null,
    dispositions: [],
    actor: "Owner",
    deviceId: "POS-A"
  };
}

test("Migration 024 creates only empty additive order-modification structures", () => {
  const { database } = fixture();
  const expected = [
    "operations_order_modification_intents",
    "operations_order_modification_intent_items",
    "operations_order_modification_reservations",
    "operations_order_replacements",
    "operations_payment_adjustments",
    "operations_order_item_dispositions"
  ];
  for (const table of expected) assert.equal(database.queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)?.count, 0);
  assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM schema_migrations WHERE migration_id = '024_operations_order_modification_foundation.sql'")?.count, 1);
  assert.equal(database.queryOne<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check, "ok");
  database.close();
});

test("Migration 024 upgrades populated Operations data without backfill and is rerun/restart safe", () => {
  const value = fixture();
  const order = createScheduled(value, "legacy-before-024");
  const before = {
    order: value.database.queryOne<Record<string, unknown>>("SELECT * FROM operations_orders WHERE order_id = ?", [order.orderId]),
    items: value.database.queryMany<Record<string, unknown>>("SELECT * FROM operations_order_items WHERE order_id = ? ORDER BY order_item_id", [order.orderId]),
    inventory: value.database.queryMany<Record<string, unknown>>("SELECT * FROM operations_sellable_inventory WHERE event_id = ? ORDER BY product_version_id", [value.event.eventId])
  };
  for (const table of [
    "operations_order_item_dispositions",
    "operations_payment_adjustments",
    "operations_order_replacements",
    "operations_order_modification_reservations",
    "operations_order_modification_intent_items",
    "operations_order_modification_intents"
  ]) value.database.execute(`DROP TABLE ${table}`);
  value.database.execute("DELETE FROM schema_migrations WHERE migration_id = '024_operations_order_modification_foundation.sql'");

  runMigrations(value.database);
  runMigrations(value.database);
  assert.deepEqual(value.database.queryOne<Record<string, unknown>>("SELECT * FROM operations_orders WHERE order_id = ?", [order.orderId]), before.order);
  assert.deepEqual(value.database.queryMany<Record<string, unknown>>("SELECT * FROM operations_order_items WHERE order_id = ? ORDER BY order_item_id", [order.orderId]), before.items);
  assert.deepEqual(value.database.queryMany<Record<string, unknown>>("SELECT * FROM operations_sellable_inventory WHERE event_id = ? ORDER BY product_version_id", [value.event.eventId]), before.inventory);
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_modification_intents")?.count, 0);
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 0);
  value.database.close();

  const reopened = createDatabase({ host: "127.0.0.1", port: 0, databasePath: value.databasePath });
  runMigrations(reopened);
  assert.equal(reopened.queryOne<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check, "ok");
  assert.equal(reopened.queryOne<{ foreign_key_check: number }>("SELECT COUNT(*) AS foreign_key_check FROM pragma_foreign_key_check")?.foreign_key_check, 0);
  reopened.close();
});

test("prepare freezes the proposal, reserves only positive deltas, and replays without another reservation", () => {
  const value = fixture();
  const order = createScheduled(value);
  const before = value.database.queryOne<{ sold: number; reserved: number }>("SELECT sold_quantity AS sold, reserved_quantity AS reserved FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [value.event.eventId, meal.productVersionId]);
  assert.deepEqual(before, { sold: 1, reserved: 0 });

  const prepared = value.modifications.prepare(prepareInput(order));
  assert.equal(prepared.replayed, false);
  assert.equal(prepared.intent.state, "prepared");
  assert.equal(prepared.intent.paymentBasisStatus, "unpaid");
  assert.equal(prepared.intent.adjustmentDirection, "none");
  assert.equal(prepared.intent.adjustmentAmount, 0);
  assert.equal(prepared.intent.newTotal, 240);
  assert.equal(prepared.intent.difference.reservations.length, 2);
  assert.equal(value.orders.getOrder(order.orderId).revision, order.revision);
  assert.deepEqual(value.database.queryOne<{ sold: number; reserved: number }>("SELECT sold_quantity AS sold, reserved_quantity AS reserved FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [value.event.eventId, meal.productVersionId]), { sold: 1, reserved: 1 });
  assert.deepEqual(value.database.queryOne<{ sold: number; reserved: number }>("SELECT sold_quantity AS sold, reserved_quantity AS reserved FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [value.event.eventId, drink.productVersionId]), { sold: 0, reserved: 1 });

  const replay = value.modifications.prepare(prepareInput(order));
  assert.equal(replay.replayed, true);
  assert.equal(replay.intent.intentId, prepared.intent.intentId);
  assert.equal(value.database.queryOne<{ total: number }>("SELECT SUM(reserved_quantity) AS total FROM operations_order_modification_reservations")?.total, 2);
  value.database.close();
});

test("one root intent and inventory availability fail closed with zero partial writes", () => {
  const value = fixture();
  const order = createScheduled(value);
  const first = value.modifications.prepare(prepareInput(order));
  assert.throws(() => value.modifications.prepare({ ...prepareInput(order, "modify-2"), customerName: "Other" }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PENDING");
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_modification_intents")?.count, 1);
  assert.equal(first.intent.state, "prepared");

  value.modifications.cancelPrepared(first.intent.intentId, first.intent.intentRevision, "Owner", "重新輸入");
  const tooMany = { ...prepareInput(order, "modify-3"), items: [
    { productId: meal.productId, productVersionId: meal.productVersionId, quantity: 1, notes: null },
    { productId: drink.productId, productVersionId: drink.productVersionId, quantity: 6, notes: null }
  ] };
  assert.throws(() => value.modifications.prepare(tooMany), (error: unknown) => (error as { code?: string }).code === "INSUFFICIENT_QUANTITY");
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_modification_intents")?.count, 1);
  assert.deepEqual(value.database.queryOne<{ sold: number; reserved: number }>("SELECT sold_quantity AS sold, reserved_quantity AS reserved FROM operations_sellable_inventory WHERE event_id = ? AND product_version_id = ?", [value.event.eventId, drink.productVersionId]), { sold: 0, reserved: 0 });
  value.database.close();
});

test("a server-side pending intent locks every existing Order and Event mutation across connections", () => {
  const value = fixture();
  const order = createScheduled(value);
  const prepared = value.modifications.prepare(prepareInput(order));
  const secondDatabase = createDatabase({ host: "127.0.0.1", port: 0, databasePath: value.databasePath });
  const secondModifications = new OrderModificationService(new OrderModificationRepository(secondDatabase));
  assert.throws(() => secondModifications.prepare({ ...prepareInput(order, "second-device"), customerName: "Second POS" }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PENDING");

  const lifecycle = new LifecycleService(new LifecycleRepository(value.database));
  const payments = new PaymentService(new PaymentRepository(value.database));
  assert.throws(() => lifecycle.changeStatus(order.orderId, { status: "preparing", operator: "Kitchen" }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PENDING");
  assert.throws(() => lifecycle.markNoShow(order.orderId, { operator: "Owner" }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PENDING");
  assert.throws(() => payments.confirmPayment(order.orderId, { confirmed: true, paymentMethod: "CASH", expectedAmount: order.grandTotal, idempotencyKey: "blocked-payment", operator: "Owner", deviceId: "POS-B" }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PENDING");
  assert.throws(() => value.orders.updateScheduledOrder(order.orderId, {
    expectedRevision: order.revision,
    items: order.items.map((item) => ({ productId: item.productId, productVersionId: item.productVersionId, quantity: item.quantity, notes: item.notes })),
    scheduledPickupAt: order.scheduledPickupAt,
    customerName: "Changed outside intent",
    customerPhoneTail: order.customerPhoneTail,
    paymentMethod: order.paymentMethod,
    notes: order.notes,
    operator: "Owner",
    deviceId: "POS-B"
  }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PENDING");
  assert.throws(() => lifecycle.closeEvent(value.event.eventId, { confirmed: true, operator: "Owner" }), (error: unknown) => (error as { code?: string }).code === "EVENT_MODIFICATION_PENDING");
  assert.equal(value.modifications.getIntent(prepared.intent.intentId).state, "prepared");
  secondDatabase.close();
  value.database.close();
});

test("cancel and expiry release each held quantity once while renewal is rate limited", () => {
  const value = fixture();
  const order = createScheduled(value);
  const prepared = value.modifications.prepare(prepareInput(order));
  assert.throws(() => value.modifications.renew(prepared.intent.intentId, prepared.intent.intentRevision, "Owner"), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_RENEWAL_CONFLICT");
  value.advance(31_000);
  const renewed = value.modifications.renew(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
  assert.equal(renewed.intentRevision, 2);
  const cancelled = value.modifications.cancelPrepared(renewed.intentId, renewed.intentRevision, "Owner", "不再修改");
  assert.equal(cancelled.state, "cancelled");
  assert.equal(value.database.queryOne<{ total: number }>("SELECT COALESCE(SUM(reserved_quantity), 0) AS total FROM operations_sellable_inventory WHERE event_id = ?", [value.event.eventId])?.total, 0);
  assert.throws(() => value.modifications.cancelPrepared(cancelled.intentId, cancelled.intentRevision, "Owner", "again"), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_CANCEL_CONFLICT");

  const expiring = value.modifications.prepare({ ...prepareInput(order, "modify-expire"), customerName: "After cancel" });
  value.advance(10 * 60_000 + 1);
  assert.equal(value.modifications.expirePrepared(), 1);
  assert.equal(value.modifications.getIntent(expiring.intent.intentId).state, "expired");
  assert.equal(value.database.queryOne<{ total: number }>("SELECT COALESCE(SUM(reserved_quantity), 0) AS total FROM operations_sellable_inventory WHERE event_id = ?", [value.event.eventId])?.total, 0);
  assert.equal(value.modifications.expirePrepared(), 0);
  value.database.close();
});

test("external and reconciliation states never auto-expire and retain reservations", () => {
  const value = fixture();
  const paid = value.orders.createPosOrder({
    source: "pos",
    eventId: value.event.eventId,
    idempotencyKey: "paid-order",
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 1, notes: null }],
    scheduledPickupAt: null,
    paymentCollected: true,
    customerName: null,
    customerPhoneTail: null,
    paymentMethod: "CASH",
    operator: "Owner",
    deviceId: "POS-A",
    notes: null
  }).order;
  assert.throws(() => value.modifications.prepare({
    ...prepareInput(paid, "paid-method-rewrite"),
    scheduledPickupAt: null,
    customerName: null,
    customerPhoneTail: null,
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 1, notes: null }],
    paymentMethod: "LINE_PAY"
  }), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_PAYMENT_METHOD_LOCKED");
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_modification_intents")?.count, 0);
  const prepared = value.modifications.prepare({
    ...prepareInput(paid, "paid-supplement"),
    scheduledPickupAt: null,
    customerName: null,
    customerPhoneTail: null,
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 2, notes: null }],
    supplementMethod: "LINE_PAY"
  });
  assert.equal(prepared.intent.adjustmentDirection, "supplement");
  assert.equal(prepared.intent.adjustmentAmount, 100);
  const external = value.modifications.beginExternalAction(prepared.intent.intentId, prepared.intent.intentRevision, "Owner");
  assert.equal(external.state, "external_in_progress");
  value.advance(24 * 60 * 60_000);
  assert.equal(value.modifications.expirePrepared(), 0);
  const reconciliation = value.modifications.requireReconciliation(external.intentId, external.intentRevision, "Admin", "網路中斷，款項狀態待核對");
  assert.equal(reconciliation.state, "reconciliation_required");
  assert.equal(value.modifications.expirePrepared(), 0);
  assert.equal(value.database.queryOne<{ total: number }>("SELECT COALESCE(SUM(reserved_quantity), 0) AS total FROM operations_sellable_inventory WHERE event_id = ?", [value.event.eventId])?.total, 1);
  value.database.close();
});

test("decrease requires exact immutable disposition proposal and ready production content resets in the frozen result", () => {
  const value = fixture();
  const original = value.orders.createPosOrder({
    source: "pos",
    eventId: value.event.eventId,
    idempotencyKey: "two-meals",
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 2, notes: null }],
    scheduledPickupAt: "2026-09-05T18:00:00+08:00",
    paymentCollected: false,
    customerName: "Miles",
    customerPhoneTail: "123",
    paymentMethod: "CASH",
    operator: "Owner",
    deviceId: "POS-A",
    notes: null
  }).order;
  value.database.execute("UPDATE operations_orders SET production_status = 'ready' WHERE order_id = ?", [original.orderId]);
  const ready = value.orders.getOrder(original.orderId);
  const input = {
    orderId: ready.orderId,
    expectedRevision: ready.revision,
    idempotencyKey: "decrease",
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 1, notes: null }],
    scheduledPickupAt: ready.scheduledPickupAt,
    customerName: ready.customerName,
    customerPhoneTail: ready.customerPhoneTail,
    paymentMethod: ready.paymentMethod,
    notes: "少一份",
    supplementMethod: null,
    dispositions: [],
    actor: "Owner",
    deviceId: "POS-A"
  };
  assert.throws(() => value.modifications.prepare(input), (error: unknown) => (error as { code?: string }).code === "ORDER_MODIFICATION_DISPOSITION_REQUIRED");
  const prepared = value.modifications.prepare({ ...input, dispositions: [{ orderItemId: ready.items[0]!.orderItemId, returnedToSellableQuantity: 0, notReturnedQuantity: 1, reason: "已製作，客人取消" }] });
  assert.equal(prepared.intent.productionResetRequired, true);
  assert.equal(prepared.intent.after.productionStatus, "preparing");
  assert.equal(prepared.intent.difference.dispositions[0]?.notReturnedQuantity, 1);
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_item_dispositions")?.count, 0);
  value.database.close();
});

test("effective Order projection hides a superseded member without historical backfill", () => {
  const value = fixture();
  const root = createScheduled(value, "root");
  const replacement = createScheduled(value, "replacement");
  const prepared = value.modifications.prepare({ ...prepareInput(root, "metadata-only"), items: root.items.map((item) => ({ productId: item.productId, productVersionId: item.productVersionId, quantity: item.quantity, notes: item.notes })), customerName: "Revised" });
  value.database.execute("UPDATE operations_order_modification_intents SET state = 'confirmed', confirmed_at = ? WHERE intent_id = ?", [new Date().toISOString(), prepared.intent.intentId]);
  value.database.execute(`INSERT INTO operations_order_replacements
    (replacement_id, intent_id, event_id, root_order_id, superseded_order_id, replacement_order_id, effective_revision, reason, created_by, device_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 2, 'test projection', 'Owner', 'POS-A', ?)`, ["replacement_edge", prepared.intent.intentId, value.event.eventId, root.orderId, root.orderId, replacement.orderId, new Date().toISOString()]);
  const projected = value.orders.listEventOrders(value.event.eventId);
  assert.equal(projected.some((order) => order.orderId === root.orderId), false);
  assert.equal(projected.some((order) => order.orderId === replacement.orderId), true);
  const modificationRepository = new OrderModificationRepository(value.database);
  const lifecycleRepository = new LifecycleRepository(value.database);
  assert.equal(modificationRepository.resolveEffectiveOrderId(root.orderId), replacement.orderId);
  assert.equal(lifecycleRepository.listEventOrders(value.event.eventId).length, 1);
  assert.equal(lifecycleRepository.unresolvedCount(value.event.eventId), 1);
  const statistics = lifecycleRepository.getStatistics(value.event.eventId) as { orderCount: number; ledgerAmount: number; products: readonly { quantity: number }[] };
  assert.equal(statistics.orderCount, 1);
  assert.equal(statistics.ledgerAmount, replacement.grandTotal);
  assert.equal(statistics.products[0]?.quantity, 1);
  value.database.execute("UPDATE operations_orders SET order_status = 'completed', production_status = 'served' WHERE order_id IN (?, ?)", [root.orderId, replacement.orderId]);
  const reportEvent = lifecycleRepository.findEvent(value.event.eventId)!;
  const report = lifecycleRepository.buildReport(reportEvent, "2026-09-05T12:00:00.000Z", {
    expected: { cash: 0, linePay: 0 },
    declared: { cash: 0, linePay: 0, other: 0 },
    variance: { cash: 0, linePay: 0 },
    outcome: "matched",
    exception: null
  });
  assert.deepEqual(report.orders, { total: 1, completed: 1, cancelled: 0, noShow: 0 });
  assert.equal(report.products[0]?.quantity, 1);
  assert.equal(value.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 1);
  value.database.close();
});
