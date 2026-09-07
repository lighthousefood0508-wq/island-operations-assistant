import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { ProductContractV2 } from "../shared/contracts/product-contract.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import {
  OperationsRepository,
  OperationsService,
  OrderModificationRepository,
  OrderModificationService,
  OrderRepository,
  OrderService,
  PaymentRepository
} from "../domains/operations/index.js";
import { closeRosServer, createRosServer } from "../server/index.js";
import { OrderModificationExpiryRunner } from "../server/jobs/order-modification-expiry-runner.js";

const meal: ProductContractV2 = {
  contractVersion: "2",
  productId: "product_expiry_meal",
  productVersionId: "product_version_expiry_meal",
  categoryId: "category_expiry",
  displayCategoryName: "主餐",
  displayCategorySortOrder: 1,
  displayName: "東坡肉",
  posName: "東坡",
  sellingPrice: 100,
  channels: ["pos"],
  isActive: true,
  publishedAt: "2026-09-07T00:00:00.000Z"
};

async function removeDatabase(databasePath: string): Promise<void> {
  for (const suffix of ["", "-wal", "-shm"]) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(`${databasePath}${suffix}`, { force: true });
        break;
      } catch (error) {
        if (!(["EPERM", "EBUSY"] as const).includes((error as NodeJS.ErrnoException).code as "EPERM" | "EBUSY")) throw error;
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }
}

function seed(databasePath: string, now: () => Date) {
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  const operations = new OperationsService(new OperationsRepository(database));
  const paymentRepository = new PaymentRepository(database);
  const orders = new OrderService(new OrderRepository(database), paymentRepository);
  const event = operations.createEvent({ eventCode: "EXPIRY", displayName: "到期測試", date: "2026-09-07", startTime: "10:00", endTime: "22:00" });
  operations.setSellableInventory(event.eventId, meal, { plannedQuantity: 50 });
  operations.openEvent(event.eventId);
  const modifications = new OrderModificationService(new OrderModificationRepository(database), now);
  const create = (key: string, paid: boolean, method: "CASH" | "LINE_PAY") => orders.createPosOrder({
    source: "pos",
    eventId: event.eventId,
    idempotencyKey: key,
    items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 1, notes: null }],
    scheduledPickupAt: null,
    paymentCollected: paid,
    customerName: "Owner",
    customerPhoneTail: "123",
    paymentMethod: method,
    operator: "Owner",
    deviceId: "POS-A",
    notes: null
  }).order;
  const prepare = (key: string, paid: boolean, method: "CASH" | "LINE_PAY" = "CASH") => {
    const order = create(`${key}-order`, paid, method);
    return modifications.prepare({
      orderId: order.orderId,
      expectedRevision: order.revision,
      idempotencyKey: `${key}-intent`,
      items: [{ productId: meal.productId, productVersionId: meal.productVersionId, quantity: 2, notes: null }],
      scheduledPickupAt: null,
      customerName: order.customerName,
      customerPhoneTail: order.customerPhoneTail,
      paymentMethod: order.paymentMethod,
      notes: null,
      supplementMethod: paid ? method : null,
      dispositions: [],
      actor: "Owner",
      deviceId: "POS-A"
    }).intent;
  };
  return { database, event, modifications, prepare };
}

async function listen(server: ReturnType<typeof createRosServer>): Promise<void> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Runtime expiry condition was not reached within the bounded test window.");
}

test("runtime startup and bounded periodic sweeps release only expired prepared intents and stop cleanly", async () => {
  const databasePath = path.resolve("data", `order-modification-expiry-runtime-${randomUUID()}.sqlite`);
  let current = new Date("2026-09-07T05:00:00.000Z");
  const now = () => current;
  let server: ReturnType<typeof createRosServer> | undefined;
  let stage = "seed";
  try {
    const value = seed(databasePath, now);
    const startupExpired = value.prepare("startup-expired", false);
    value.database.execute("UPDATE operations_order_modification_intents SET expires_at = ? WHERE intent_id = ?", ["2026-09-07T04:59:59.000Z", startupExpired.intentId]);
    const periodic = value.prepare("periodic", false);
    const externalPrepared = value.prepare("external", true);
    const external = value.modifications.beginExternalAction(externalPrepared.intentId, externalPrepared.intentRevision, "Owner");
    const reconciliationPrepared = value.prepare("reconciliation", true, "LINE_PAY");
    const reconciliationExternal = value.modifications.beginExternalAction(reconciliationPrepared.intentId, reconciliationPrepared.intentRevision, "Owner");
    const reconciliation = value.modifications.requireReconciliation(reconciliationExternal.intentId, reconciliationExternal.intentRevision, "Owner", "無法確認款項");
    value.database.close();

    stage = "create runtime";
    let sweeps = 0;
    let failures = 0;
    server = createRosServer({ host: "127.0.0.1", port: 0, databasePath }, {
      orderModificationClock: now,
      orderModificationExpiryIntervalMs: 20,
      onOrderModificationExpirySweep: () => { sweeps += 1; },
      onOrderModificationExpiryFailure: () => { failures += 1; }
    });
    await listen(server);

    stage = "startup assertions";
    const inspect = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      assert.equal(inspect.queryOne<{ state: string }>("SELECT state FROM operations_order_modification_intents WHERE intent_id = ?", [startupExpired.intentId])?.state, "expired");
      assert.equal(inspect.queryOne<{ state: string }>("SELECT state FROM operations_order_modification_intents WHERE intent_id = ?", [periodic.intentId])?.state, "prepared");
      current = new Date("2026-09-07T05:11:00.000Z");
      stage = "periodic assertions";
      await waitFor(() => inspect.queryOne<{ state: string }>("SELECT state FROM operations_order_modification_intents WHERE intent_id = ?", [periodic.intentId])?.state === "expired");
      assert.equal(inspect.queryOne<{ state: string }>("SELECT state FROM operations_order_modification_intents WHERE intent_id = ?", [external.intentId])?.state, "external_in_progress");
      assert.equal(inspect.queryOne<{ state: string }>("SELECT state FROM operations_order_modification_intents WHERE intent_id = ?", [reconciliation.intentId])?.state, "reconciliation_required");
      assert.equal(inspect.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_modification_reservations WHERE status = 'held'")?.count, 2);
      assert.equal(inspect.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'order.modification_expired'")?.count, 2);
    } finally {
      inspect.close();
    }

    assert.ok(sweeps >= 2);
    assert.equal(failures, 0);
    stage = "shutdown assertions";
    await closeRosServer(server);
    const stoppedAt = sweeps;
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(sweeps, stoppedAt);
    assert.equal(server.listenerCount("close"), 0);
    server = undefined;
  } catch (error) {
    throw new Error(`${stage}: ${(error as { code?: string; message?: string }).code ?? "error"} ${(error as { message?: string }).message ?? ""}`);
  } finally {
    if (server) await closeRosServer(server);
    await removeDatabase(databasePath);
  }
});

test("restart startup sweep recovers a prepared lease that expired while the server was down", async () => {
  const databasePath = path.resolve("data", `order-modification-expiry-restart-${randomUUID()}.sqlite`);
  let current = new Date("2026-09-07T05:00:00.000Z");
  const now = () => current;
  try {
    const value = seed(databasePath, now);
    const prepared = value.prepare("restart", false);
    value.database.close();

    const first = createRosServer({ host: "127.0.0.1", port: 0, databasePath }, { orderModificationClock: now, orderModificationExpiryIntervalMs: 50 });
    await listen(first);
    await closeRosServer(first);

    current = new Date("2026-09-07T05:11:00.000Z");
    const second = createRosServer({ host: "127.0.0.1", port: 0, databasePath }, { orderModificationClock: now, orderModificationExpiryIntervalMs: 50 });
    await listen(second);
    const inspect = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      assert.equal(inspect.queryOne<{ state: string }>("SELECT state FROM operations_order_modification_intents WHERE intent_id = ?", [prepared.intentId])?.state, "expired");
      assert.equal(inspect.queryOne<{ terminal_at: string | null }>("SELECT terminal_at FROM operations_order_modification_reservations WHERE intent_id = ?", [prepared.intentId])?.terminal_at, current.toISOString());
    } finally {
      inspect.close();
    }
    await closeRosServer(second);
  } finally {
    await removeDatabase(databasePath);
  }
});

test("expiry runner survives a failed sweep and keeps one non-overlapping bounded timer", async () => {
  let attempts = 0;
  let failures = 0;
  const service = {
    sweepExpiredPrepared: () => {
      attempts += 1;
      if (attempts === 1) throw new Error("sensitive internal detail");
      return { expired: 0, failures: 0 };
    }
  } as OrderModificationService;
  const runner = new OrderModificationExpiryRunner(service, { intervalMs: 20, onFailure: () => { failures += 1; } });
  runner.start();
  try {
    await waitFor(() => attempts >= 2);
    assert.equal(failures, 1);
    assert.equal(runner.running, true);
  } finally {
    runner.stop();
  }
  const stoppedAt = attempts;
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(attempts, stoppedAt);
  assert.equal(runner.running, false);
});
