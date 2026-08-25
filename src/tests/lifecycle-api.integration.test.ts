import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";
import { createDatabase } from "../shared/database/database-provider.js";

async function request(baseUrl: string, pathName: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathName}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
async function setup(quantity = 2) {
  const databasePath = path.resolve("data", `lifecycle-${randomUUID()}.sqlite`);
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath }); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "Meal", sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "Meal", categoryId: category.body.data.categoryId, displayName: "Meal", posName: "Meal", sellingPrice: 100, channels: ["pos"] });
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "LIFE", displayName: "Lifecycle", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: quantity });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  return { server, baseUrl, databasePath, eventId: event.body.data.eventId, product: published.body.data.contract };
}
async function createOrder(baseUrl: string, eventId: string, product: any, key: string, customerName: string | null = null) { return request(baseUrl, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: key, items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }], customerName, customerPhoneTail: customerName ? "123" : null, paymentMethod: "LINE_PAY", notes: null }); }
async function serveOrder(baseUrl: string, orderId: string) {
  for (const status of ["preparing", "ready", "served"]) {
    const result = await request(baseUrl, `/api/orders/${orderId}/status`, "PATCH", { status, operator: "test" });
    assert.equal(result.status, 200);
  }
}
async function revertCompletion(baseUrl: string, orderId: string, deviceId = "Kitchen-A") {
  return request(baseUrl, `/api/orders/${orderId}/production/revert-completion`, "POST", {
    confirmed: true,
    reason: "accidental_completion",
    operator: "kitchen",
    deviceId
  });
}
async function confirmPayment(baseUrl: string, orderId: string, key: string, overrides: Record<string, unknown> = {}) {
  return request(baseUrl, `/api/orders/${orderId}/payment/confirm`, "POST", {
    confirmed: true,
    paymentMethod: "CASH",
    expectedAmount: 100,
    idempotencyKey: key,
    operator: "Owner",
    deviceId: "POS-A",
    ...overrides
  });
}
async function saveZeroCloseout(baseUrl: string, eventId: string, receipts: Partial<{ cashReceived: number; linePayReceived: number; otherReceived: number }> = {}) {
  const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
  return request(baseUrl, `/api/events/${eventId}/closeout`, "PUT", { cashReceived: receipts.cashReceived ?? 0, linePayReceived: receipts.linePayReceived ?? 0, otherReceived: receipts.otherReceived ?? 0, wasteAmount: 0, notes: "", items: statistics.body.data.inventory.map((item: any) => ({ productVersionId: item.productVersionId, wasteQuantity: 0 })) });
}

test("lifecycle keeps Order, Payment, and Production states separate", async () => {
  const { server, baseUrl, eventId, product } = await setup(); const created = await createOrder(baseUrl, eventId, product, "life-a", "Miles"); const id = created.body.data.orderId;
  assert.equal(created.body.data.orderStatus, "confirmed"); assert.equal(created.body.data.paymentStatus, "unpaid"); assert.equal(created.body.data.productionStatus, "not_started");
  const list = await request(baseUrl, `/api/events/${eventId}/orders`);
  assert.equal(list.body.data[0].customerName, "Miles");
  assert.equal(list.body.data[0].customerPhoneTail, "123");
  assert.equal(list.body.data[0].paymentMethod, "LINE_PAY");
  assert.equal((await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "ready" })).status, 409);
  assert.equal((await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "preparing" })).body.data.productionStatus, "preparing");
  assert.equal((await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "ready" })).body.data.productionStatus, "ready");
  const served = await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "served" });
  assert.equal(served.body.data.productionStatus, "served");
  assert.match(served.body.data.servedAt, /^20/);
  assert.match((await request(baseUrl, `/api/events/${eventId}/orders`)).body.data[0].servedAt, /^20/);
  const incomplete = await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "completed" }); assert.equal(incomplete.status, 409); assert.equal(incomplete.body.error.code, "ORDER_COMPLETION_REQUIREMENTS_NOT_MET");
  server.close(); await once(server, "close");
});

test("served reservation payment is authoritative, idempotent, audited, projected, and unblocks close", async () => {
  const { server, baseUrl, databasePath, eventId, product } = await setup();
  try {
    const created = await request(baseUrl, "/api/orders", "POST", {
      source: "pos",
      eventId,
      idempotencyKey: "reservation-payment",
      items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }],
      scheduledPickupAt: "2026-07-20T18:30:00+08:00",
      paymentCollected: false,
      customerName: "Miles",
      customerPhoneTail: "123",
      paymentMethod: "LINE_PAY",
      notes: null
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.paymentStatus, "unpaid");
    await serveOrder(baseUrl, created.body.data.orderId);

    const paid = await confirmPayment(baseUrl, created.body.data.orderId, "payment-one");
    assert.equal(paid.status, 200);
    assert.equal(paid.body.data.replayed, false);
    assert.equal(paid.body.data.order.paymentStatus, "paid");
    assert.equal(paid.body.data.order.orderStatus, "completed");
    assert.equal(paid.body.data.order.paidTotal, 100);
    assert.equal(paid.body.data.payment.paymentMethod, "CASH");
    assert.match(paid.body.data.payment.paidAt, /^20/);

    const replay = await confirmPayment(baseUrl, created.body.data.orderId, "payment-one");
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.replayed, true);
    const conflict = await confirmPayment(baseUrl, created.body.data.orderId, "payment-one", { paymentMethod: "LINE_PAY" });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, "IDEMPOTENCY_KEY_REUSED");
    const duplicate = await confirmPayment(baseUrl, created.body.data.orderId, "payment-two");
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "PAYMENT_ALREADY_CONFIRMED");

    const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
    assert.equal(statistics.body.data.ledgerAmount, 100);
    assert.equal(statistics.body.data.receivedAmount, 100);
    assert.equal(statistics.body.data.cashReceivedAmount, 100);
    assert.equal(statistics.body.data.linePayReceivedAmount, 0);
    assert.equal(statistics.body.data.unresolvedCount, 0);
    const closeout = await saveZeroCloseout(baseUrl, eventId, { cashReceived: 100 });
    assert.equal(closeout.status, 200);
    const closed = await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true, operator: "Owner" });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.data.report.payments.cash, 100);
    assert.deepEqual(closed.body.data.report.paymentReconciliation, {
      expected: { cash: 100, linePay: 0 }, declared: { cash: 100, linePay: 0, other: 0 }, variance: { cash: 0, linePay: 0 }, outcome: "matched", exception: null
    });

    const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payments WHERE order_id = ?", [created.body.data.orderId])?.count, 1);
      const audit = database.queryOne<{ after_json: string }>("SELECT after_json FROM audit_logs WHERE entity_id = ? AND action = 'payment_confirmed'", [created.body.data.orderId]);
      assert.ok(audit);
      assert.deepEqual(JSON.parse(audit.after_json), {
        orderId: created.body.data.orderId,
        eventId,
        paymentId: paid.body.data.payment.paymentId,
        paymentMethod: "CASH",
        amount: 100,
        paidAt: paid.body.data.payment.paidAt,
        operator: "Owner",
        deviceId: "POS-A",
        identityTrust: "client_reported",
        fromPaymentStatus: "unpaid",
        toPaymentStatus: "paid",
        fromOrderStatus: "confirmed",
        toOrderStatus: "completed"
      });
    } finally {
      database.close();
    }
  } finally {
    const closed = once(server, "close");
    server.closeAllConnections();
    server.close();
    await closed;
  }
});

test("PaymentCloseoutReconciliationBoundary blocks receipt differences until an explicit immutable exception is accepted", async () => {
  const { server, baseUrl, eventId, product } = await setup();
  try {
    const order = await createOrder(baseUrl, eventId, product, "reconcile-paid");
    await serveOrder(baseUrl, order.body.data.orderId);
    assert.equal((await confirmPayment(baseUrl, order.body.data.orderId, "reconcile-payment")).status, 200);
    assert.equal((await saveZeroCloseout(baseUrl, eventId)).status, 200);

    const blocked = await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true, operator: "Owner" });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, "PAYMENT_RECONCILIATION_EXCEPTION_REQUIRED");
    assert.deepEqual(blocked.body.error.details, { cashVariance: "-100", linePayVariance: "0" });
    assert.equal((await request(baseUrl, `/api/events/${eventId}/daily-report`)).status, 404);

    const closed = await request(baseUrl, `/api/events/${eventId}/close`, "POST", {
      confirmed: true, operator: "Owner", reconciliationException: { confirmed: true, reason: "Cash count pending supervised verification" }
    });
    assert.equal(closed.status, 200);
    assert.deepEqual(closed.body.data.report.paymentReconciliation, {
      expected: { cash: 100, linePay: 0 }, declared: { cash: 0, linePay: 0, other: 0 }, variance: { cash: -100, linePay: 0 }, outcome: "exception_accepted",
      exception: { reason: "Cash count pending supervised verification", actor: "Owner" }
    });
    const replay = await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true, operator: "Different" });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.data.report.paymentReconciliation, closed.body.data.report.paymentReconciliation);
  } finally {
    const closed = once(server, "close");
    server.closeAllConnections();
    server.close();
    await closed;
  }
});

test("payment confirmation rejects invalid lifecycle and amount states", async () => {
  const { server, baseUrl, eventId, product } = await setup(5);
  try {
    const unserved = await createOrder(baseUrl, eventId, product, "pay-unserved");
    assert.equal((await confirmPayment(baseUrl, unserved.body.data.orderId, "pay-unserved")).body.error.code, "ORDER_NOT_SERVED");
    await serveOrder(baseUrl, unserved.body.data.orderId);
    assert.equal((await confirmPayment(baseUrl, unserved.body.data.orderId, "pay-mismatch", { expectedAmount: 99 })).body.error.code, "PAYMENT_AMOUNT_MISMATCH");

    const cancelled = await createOrder(baseUrl, eventId, product, "pay-cancelled");
    await request(baseUrl, `/api/orders/${cancelled.body.data.orderId}/status`, "PATCH", { status: "cancelled" });
    assert.equal((await confirmPayment(baseUrl, cancelled.body.data.orderId, "pay-cancelled")).body.error.code, "ORDER_NOT_PAYABLE");

    const noShow = await createOrder(baseUrl, eventId, product, "pay-no-show");
    await request(baseUrl, `/api/orders/${noShow.body.data.orderId}/no-show`, "POST", {});
    assert.equal((await confirmPayment(baseUrl, noShow.body.data.orderId, "pay-no-show")).body.error.code, "ORDER_NOT_PAYABLE");
    assert.equal((await confirmPayment(baseUrl, "missing-order", "pay-missing")).body.error.code, "ORDER_NOT_FOUND");
  } finally {
    const closed = once(server, "close");
    server.closeAllConnections();
    server.close();
    await closed;
  }
});

test("concurrent payment confirmation succeeds once and transaction failure rolls back all payment state", async () => {
  const { server, baseUrl, databasePath, eventId, product } = await setup(3);
  try {
    const concurrent = await createOrder(baseUrl, eventId, product, "pay-concurrent");
    await serveOrder(baseUrl, concurrent.body.data.orderId);
    const results = await Promise.all([
      confirmPayment(baseUrl, concurrent.body.data.orderId, "pay-device-a", { deviceId: "POS-A" }),
      confirmPayment(baseUrl, concurrent.body.data.orderId, "pay-device-b", { deviceId: "POS-B" })
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(results.find((result) => result.status === 409)?.body.error.code, "PAYMENT_ALREADY_CONFIRMED");

    const rollback = await createOrder(baseUrl, eventId, product, "pay-rollback");
    await serveOrder(baseUrl, rollback.body.data.orderId);
    const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      database.execute(`CREATE TRIGGER reject_payment_audit BEFORE INSERT ON audit_logs
        WHEN NEW.action = 'payment_confirmed' BEGIN SELECT RAISE(ABORT, 'test payment audit failure'); END`);
    } finally {
      database.close();
    }
    const failed = await confirmPayment(baseUrl, rollback.body.data.orderId, "pay-rollback");
    assert.equal(failed.status, 500);
    const verify = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      const order = verify.queryOne<{ order_status: string; payment_status: string; paid_total: number }>("SELECT order_status, payment_status, paid_total FROM operations_orders WHERE order_id = ?", [rollback.body.data.orderId]);
      assert.deepEqual(order, { order_status: "confirmed", payment_status: "unpaid", paid_total: 0 });
      assert.equal(verify.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payments WHERE order_id = ?", [rollback.body.data.orderId])?.count, 0);
    } finally {
      verify.close();
    }
  } finally {
    const closed = once(server, "close");
    server.closeAllConnections();
    server.close();
    await closed;
  }
});

test("paid onsite order completes automatically when Production becomes served", async () => {
  const { server, baseUrl, eventId, product } = await setup();
  try {
    const created = await request(baseUrl, "/api/orders", "POST", {
      source: "pos",
      eventId,
      idempotencyKey: "onsite-paid-api",
      items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }],
      paymentCollected: true,
      customerName: "Miles",
      customerPhoneTail: "123",
      paymentMethod: "LINE_PAY",
      operator: "Owner",
      deviceId: "POS-A",
      notes: null
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.paymentStatus, "paid");
    assert.equal(created.body.data.orderStatus, "confirmed");
    await serveOrder(baseUrl, created.body.data.orderId);
    const completed = await request(baseUrl, `/api/orders/${created.body.data.orderId}`);
    assert.equal(completed.body.data.productionStatus, "served");
    assert.equal(completed.body.data.orderStatus, "completed");
    assert.equal(completed.body.data.paymentStatus, "paid");
  } finally {
    const closed = once(server, "close");
    server.closeAllConnections();
    server.close();
    await closed;
  }
});

test("production completion reversal restores the audited predecessor and preserves Order, Payment, Inventory, and Statistics", async () => {
  const { server, baseUrl, databasePath, eventId, product } = await setup(2);
  try {
    const created = await createOrder(baseUrl, eventId, product, "revert-success", "Miles");
    const orderId = created.body.data.orderId;
    const beforeStatistics = (await request(baseUrl, `/api/events/${eventId}/statistics`)).body.data;
    const beforeProducts = (await request(baseUrl, "/api/events/current/products")).body.data;
    await serveOrder(baseUrl, orderId);
    const served = await request(baseUrl, `/api/orders/${orderId}`);
    const originalServedAt = served.body.data.servedAt;
    const unconfirmed = await request(baseUrl, `/api/orders/${orderId}/production/revert-completion`, "POST", {
      confirmed: false,
      reason: "accidental_completion",
      operator: "kitchen",
      deviceId: "Kitchen-A"
    });
    assert.equal(unconfirmed.status, 400);
    assert.equal(unconfirmed.body.error.code, "REVERSAL_CONFIRMATION_REQUIRED");
    const paused = await request(baseUrl, `/api/admin/events/${eventId}/pause`, "POST", {});
    assert.equal(paused.status, 200);
    assert.equal(paused.body.data.status, "paused");

    const reverted = await revertCompletion(baseUrl, orderId);
    assert.equal(reverted.status, 200);
    assert.equal(reverted.body.data.productionStatus, "ready");
    assert.equal(reverted.body.data.servedAt, null);
    assert.equal(reverted.body.data.orderStatus, created.body.data.orderStatus);
    assert.equal(reverted.body.data.paymentStatus, created.body.data.paymentStatus);
    assert.equal(reverted.body.data.paymentMethod, created.body.data.paymentMethod);
    assert.equal(reverted.body.data.grandTotal, created.body.data.grandTotal);

    const afterStatistics = (await request(baseUrl, `/api/events/${eventId}/statistics`)).body.data;
    const afterProducts = (await request(baseUrl, "/api/events/current/products")).body.data;
    assert.equal(afterStatistics.ledgerAmount, beforeStatistics.ledgerAmount);
    assert.deepEqual(afterStatistics.products, beforeStatistics.products);
    assert.deepEqual(afterStatistics.inventory, beforeStatistics.inventory);
    assert.deepEqual(afterProducts, beforeProducts);

    const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      const servedAudits = database.queryMany<{ after_json: string; occurred_at: string }>("SELECT after_json, occurred_at FROM audit_logs WHERE entity_id = ? AND action = 'production_status_changed' AND after_json LIKE '%\"to\":\"served\"%'", [orderId]);
      assert.equal(servedAudits.length, 1);
      assert.equal(servedAudits[0]?.occurred_at, originalServedAt);
      const reversalAudits = database.queryMany<{ after_json: string }>("SELECT after_json FROM audit_logs WHERE entity_id = ? AND action = 'production_completion_reverted'", [orderId]);
      assert.equal(reversalAudits.length, 1);
      assert.deepEqual(JSON.parse(reversalAudits[0]?.after_json ?? "{}"), {
        from: "served",
        to: "ready",
        reason: "accidental_completion",
        originalServedAt,
        operator: "kitchen",
        deviceId: "Kitchen-A",
        identityTrust: "client_reported",
        eventId,
        orderId
      });
    } finally {
      database.close();
    }

    const blockedClose = await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true });
    assert.equal(blockedClose.status, 409);
    assert.equal(blockedClose.body.error.code, "EVENT_CLOSE_BLOCKED");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("production completion reversal rejects missing or invalid history without leaving an Audit", async () => {
  for (const scenario of ["missing", "invalid"] as const) {
    const { server, baseUrl, databasePath, eventId, product } = await setup(1);
    try {
      const created = await createOrder(baseUrl, eventId, product, `revert-${scenario}`);
      const orderId = created.body.data.orderId;
      await serveOrder(baseUrl, orderId);
      const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
      try {
        if (scenario === "missing") {
          database.execute("DELETE FROM audit_logs WHERE entity_id = ? AND action = 'production_status_changed' AND after_json LIKE '%\"to\":\"served\"%'", [orderId]);
        } else {
          database.execute("UPDATE audit_logs SET after_json = ? WHERE entity_id = ? AND action = 'production_status_changed' AND after_json LIKE '%\"to\":\"served\"%'", [JSON.stringify({ from: "served", to: "served" }), orderId]);
        }
      } finally {
        database.close();
      }

      const result = await revertCompletion(baseUrl, orderId);
      assert.equal(result.status, 409);
      assert.equal(result.body.error.code, scenario === "missing" ? "REVERSAL_HISTORY_MISSING" : "INVALID_PREVIOUS_PRODUCTION_STATUS");
      const unchanged = await request(baseUrl, `/api/orders/${orderId}`);
      assert.equal(unchanged.body.data.productionStatus, "served");
      assert.match(unchanged.body.data.servedAt, /^20/);
      const auditDatabase = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
      try {
        assert.equal(auditDatabase.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id = ? AND action = 'production_completion_reverted'", [orderId])?.count, 0);
      } finally {
        auditDatabase.close();
      }
    } finally {
      server.close();
      await once(server, "close");
    }
  }
});

test("production completion reversal enforces Order and Event safety conditions", async () => {
  const cases = [
    { name: "not served", arrange: async () => {}, code: "ORDER_NOT_SERVED" },
    { name: "cancelled", arrange: async (baseUrl: string, orderId: string) => { await serveOrder(baseUrl, orderId); await request(baseUrl, `/api/orders/${orderId}/no-show`, "POST", {}); }, code: "ORDER_NOT_SERVED" },
    { name: "completed", arrange: async (baseUrl: string, orderId: string, databasePath: string) => { await serveOrder(baseUrl, orderId); const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath }); try { database.execute("UPDATE operations_orders SET payment_status = 'paid', paid_total = grand_total WHERE order_id = ?", [orderId]); } finally { database.close(); } const completed = await request(baseUrl, `/api/orders/${orderId}/status`, "PATCH", { status: "completed" }); assert.equal(completed.status, 200); }, code: "ORDER_ALREADY_COMPLETED" },
    { name: "closed event", arrange: async (baseUrl: string, orderId: string, databasePath: string, eventId: string) => { await serveOrder(baseUrl, orderId); const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath }); try { database.execute("UPDATE operations_events SET status = 'closed' WHERE event_id = ?", [eventId]); } finally { database.close(); } }, code: "EVENT_NOT_ACTIVE" }
  ];
  for (const scenario of cases) {
    const { server, baseUrl, databasePath, eventId, product } = await setup(1);
    try {
      const created = await createOrder(baseUrl, eventId, product, `revert-${scenario.name}`);
      await scenario.arrange(baseUrl, created.body.data.orderId, databasePath, eventId);
      const result = await revertCompletion(baseUrl, created.body.data.orderId);
      assert.equal(result.status, 409);
      assert.equal(result.body.error.code, scenario.code);
    } finally {
      server.close();
      await once(server, "close");
    }
  }
});

test("production completion reversal is conditional, concurrent-safe, and persistent across restart", async () => {
  const { server, baseUrl, databasePath, eventId, product } = await setup(1);
  let activeServer = server;
  try {
    const created = await createOrder(baseUrl, eventId, product, "revert-concurrent");
    const orderId = created.body.data.orderId;
    await serveOrder(baseUrl, orderId);
    const [first, second] = await Promise.all([
      revertCompletion(baseUrl, orderId, "Kitchen-A"),
      revertCompletion(baseUrl, orderId, "POS-A")
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
    const failed = first.status === 409 ? first : second;
    assert.ok(["ORDER_NOT_SERVED", "PRODUCTION_CONCURRENTLY_CHANGED"].includes(failed.body.error.code));

    const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id = ? AND action = 'production_completion_reverted'", [orderId])?.count, 1);
    } finally {
      database.close();
    }

    activeServer.close();
    await once(activeServer, "close");
    activeServer = createRosServer({ host: "127.0.0.1", port: 0, databasePath });
    activeServer.listen(0, "127.0.0.1");
    await once(activeServer, "listening");
    const address = activeServer.address();
    assert.ok(address && typeof address !== "string");
    const restarted = await request(`http://127.0.0.1:${address.port}`, `/api/orders/${orderId}`);
    assert.equal(restarted.body.data.productionStatus, "ready");
    assert.equal(restarted.body.data.servedAt, null);
  } finally {
    if (activeServer.listening) {
      activeServer.close();
      await once(activeServer, "close");
    }
  }
});

test("ScheduledPickupOrderLifecycleBoundary is projected to lifecycle and statistics read models", async () => {
  const { server, baseUrl, eventId, product } = await setup();
  try {
    const created = await request(baseUrl, "/api/orders", "POST", {
      source: "pos",
      eventId,
      idempotencyKey: "scheduled-life-a",
      items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }],
      scheduledPickupAt: "2026-07-20T18:30:00+08:00",
      customerName: "Miles",
      customerPhoneTail: "123",
      paymentMethod: "CASH",
      notes: null
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.source, "pos");
    assert.equal(created.body.data.scheduledPickupAt, "2026-07-20T18:30:00+08:00");

    const list = await request(baseUrl, `/api/events/${eventId}/orders`);
    assert.equal(list.body.data[0].scheduledPickupAt, "2026-07-20T18:30:00+08:00");

    const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
    assert.equal(statistics.body.data.orderCount, 1);
    assert.equal(statistics.body.data.scheduledOrderCount, 1);
    assert.equal(statistics.body.data.inventory[0].remainingQuantity, 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});
test("manual no-show release is confirmed, idempotent, and restores inventory once", async () => {
  const { server, baseUrl, eventId, product } = await setup(1); const order = await createOrder(baseUrl, eventId, product, "no-show"); const id = order.body.data.orderId;
  const noShow = await request(baseUrl, `/api/orders/${id}/no-show`, "POST", {}); assert.equal(noShow.body.data.orderStatus, "cancelled"); assert.equal(noShow.body.data.cancellationReason, "no_show");
  assert.equal((await request(baseUrl, `/api/orders/${id}/release-inventory`, "POST", {})).status, 400);
  const [left, right] = await Promise.all([request(baseUrl, `/api/orders/${id}/release-inventory`, "POST", { confirmed: true }), request(baseUrl, `/api/orders/${id}/release-inventory`, "POST", { confirmed: true })]);
  assert.deepEqual([left.body.data.released, right.body.data.released].sort(), [false, true]);
  const products = await request(baseUrl, "/api/events/current/products"); assert.equal(products.body.data[0].remainingQuantity, 1);
  server.close(); await once(server, "close");
});

test("Event Close blocks unresolved orders, creates an idempotent daily report, and locks Event", async () => {
  const { server, baseUrl, eventId, product } = await setup(); const order = await createOrder(baseUrl, eventId, product, "close"); const id = order.body.data.orderId;
  const blocked = await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true }); assert.equal(blocked.status, 409); assert.equal(blocked.body.error.code, "EVENT_CLOSE_BLOCKED");
  await request(baseUrl, `/api/orders/${id}/no-show`, "POST", {});
  assert.equal((await saveZeroCloseout(baseUrl, eventId)).status, 200);
  const [left, right] = await Promise.all([request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true }), request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true })]);
  assert.equal(left.status, 200); assert.equal(right.status, 200); assert.deepEqual(left.body.data.report, right.body.data.report);
  const report = await request(baseUrl, `/api/events/${eventId}/daily-report`); assert.equal(report.body.data.orders.noShow, 1);
  const locked = await createOrder(baseUrl, eventId, product, "after-close"); assert.equal(locked.status, 409); assert.equal(locked.body.error.code, "EVENT_NOT_OPEN");
  server.close(); await once(server, "close");
});
