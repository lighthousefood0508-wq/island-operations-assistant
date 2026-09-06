import assert from "node:assert/strict";
import { randomUUID, scryptSync } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

async function request(baseUrl: string, pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return { response, body: await response.json() as any };
}

function json(method: string, body: unknown, cookie = "", origin = ""): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) },
    body: JSON.stringify(body)
  };
}

async function login(baseUrl: string, user: string, password: string): Promise<string> {
  const result = await request(baseUrl, "/api/auth/login", json("POST", { login: user, password }, "", baseUrl));
  assert.equal(result.response.status, 200);
  return result.response.headers.get("set-cookie") ?? "";
}

async function setupRequiredServer() {
  const databasePath = path.resolve("data", `order-modification-api-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  try {
    runMigrations(database);
    const insertUser = (id: string, loginName: string, password: string, role: "admin" | "pos" | "kitchen") => {
      const salt = randomUUID().replaceAll("-", "");
      const hash = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
      database.execute("INSERT INTO users (user_id, login, display_name, status, created_at, password_algorithm, password_salt, password_hash, password_changed_at) VALUES (?, ?, ?, 'active', '2026-09-05T00:00:00.000Z', 'scrypt:N=16384,r=8,p=1,keylen=64', ?, ?, '2026-09-05T00:00:00.000Z')", [id, loginName, loginName, salt, hash]);
      database.execute("INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES (?, ?, '2026-09-05T00:00:00.000Z')", [id, `role_${role}`]);
    };
    insertUser("user_admin_mod", "admin.mod", "admin-modification-password", "admin");
    insertUser("user_pos_mod", "pos.mod", "pos-modification-password", "pos");
    insertUser("user_kitchen_mod", "kitchen.mod", "kitchen-modification-password", "kitchen");
  } finally {
    database.close();
  }
  const server = createRosServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    authentication: {
      mode: "required",
      secureCookie: false,
      sessionTtlMinutes: 60
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, databasePath, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: ReturnType<typeof createRosServer>, databasePath: string) {
  const closed = once(server, "close");
  server.closeAllConnections();
  server.close();
  await closed;
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
}

async function createPaidOrder(baseUrl: string, cookie: string) {
  const category = await request(baseUrl, "/api/admin/categories", json("POST", { displayName: "主餐", sortOrder: 1 }, cookie, baseUrl));
  const product = await request(baseUrl, "/api/admin/products", json("POST", { internalName: "東坡肉", categoryId: category.body.data.categoryId, displayName: "東坡肉", posName: "東坡", sellingPrice: 100, channels: ["pos"] }, cookie, baseUrl));
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, json("POST", {}, cookie, baseUrl));
  const event = await request(baseUrl, "/api/admin/events", json("POST", { eventCode: "MODAPI", displayName: "改單 API", date: "2026-09-05", startTime: "10:00", endTime: "22:00" }, cookie, baseUrl));
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, json("PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 10 }, cookie, baseUrl));
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, json("POST", {}, cookie, baseUrl));
  const order = await request(baseUrl, "/api/orders", json("POST", {
    source: "pos",
    eventId: event.body.data.eventId,
    idempotencyKey: "api-root-order",
    items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }],
    scheduledPickupAt: null,
    paymentCollected: true,
    customerName: "Miles",
    customerPhoneTail: "123",
    paymentMethod: "CASH",
    notes: null,
    deviceId: "POS-A"
  }, cookie, baseUrl));
  assert.equal(order.response.status, 201);
  return { eventId: event.body.data.eventId, product: published.body.data.contract, order: order.body.data };
}

test("authenticated modification API binds actor, enforces CSRF/strict schema, and confirms one adjustment", async () => {
  const { server, databasePath, baseUrl } = await setupRequiredServer();
  try {
    const adminCookie = await login(baseUrl, "admin.mod", "admin-modification-password");
    const value = await createPaidOrder(baseUrl, adminCookie);
    const prepareBody = {
      expectedRevision: value.order.revision,
      idempotencyKey: "api-modification",
      items: [{ productId: value.product.productId, productVersionId: value.product.productVersionId, quantity: 2, notes: null }],
      scheduledPickupAt: null,
      customerName: value.order.customerName,
      customerPhoneTail: value.order.customerPhoneTail,
      paymentMethod: "CASH",
      notes: null,
      supplementMethod: "CASH",
      dispositions: [],
      actor: "spoofed-browser-actor",
      deviceId: "POS-A"
    };
    const wrongOrigin = await request(baseUrl, `/api/orders/${value.order.orderId}/modifications`, json("POST", prepareBody, adminCookie, "https://wrong.example"));
    assert.equal(wrongOrigin.response.status, 403);
    assert.equal(wrongOrigin.body.error.code, "csrf_origin_forbidden");

    const unknownField = await request(baseUrl, `/api/orders/${value.order.orderId}/modifications`, json("POST", { ...prepareBody, unsupported: true }, adminCookie, baseUrl));
    assert.equal(unknownField.response.status, 422);
    assert.equal(unknownField.body.error.code, "ORDER_MODIFICATION_INVALID");

    const prepared = await request(baseUrl, `/api/orders/${value.order.orderId}/modifications`, json("POST", prepareBody, adminCookie, baseUrl));
    assert.equal(prepared.response.status, 201);
    assert.notEqual(prepared.body.data.intent.createdBy, "spoofed-browser-actor");
    const intent = prepared.body.data.intent;

    const active = await request(baseUrl, `/api/orders/${value.order.orderId}/modifications/active`, { headers: { cookie: adminCookie } });
    assert.equal(active.response.status, 200);
    assert.equal(active.body.data.intent.intentId, intent.intentId);
    assert.equal(active.body.data.pickupNumber, value.order.orderNumber);

    const external = await request(baseUrl, `/api/order-modifications/${intent.intentId}/begin-external`, json("POST", { expectedRevision: intent.intentRevision, actor: "spoofed" }, adminCookie, baseUrl));
    assert.equal(external.response.status, 200);
    const confirmed = await request(baseUrl, `/api/order-modifications/${intent.intentId}/confirm`, json("POST", {
      expectedRevision: external.body.data.intentRevision,
      idempotencyKey: intent.idempotencyKey,
      actor: "spoofed",
      deviceId: "POS-B",
      evidence: { kind: "cash", direction: "supplement", paymentMethod: "CASH", amount: 100, attested: true }
    }, adminCookie, baseUrl));
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.body.data.intent.state, "confirmed");
    assert.equal(confirmed.body.data.paymentAdjustment.amount, 100);
    assert.notEqual(confirmed.body.data.paymentAdjustment.confirmedBy, "spoofed");

    const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_payment_adjustments")?.count, 1);
      assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_order_replacements")?.count, 1);
    } finally {
      database.close();
    }
  } finally {
    await closeServer(server, databasePath);
  }
});

test("POS can recover a server-side intent while Kitchen and anonymous callers are denied", async () => {
  const { server, databasePath, baseUrl } = await setupRequiredServer();
  try {
    const anonymous = await request(baseUrl, "/api/order-modifications/mod_missing");
    assert.equal(anonymous.response.status, 401);
    const posCookie = await login(baseUrl, "pos.mod", "pos-modification-password");
    const pos = await request(baseUrl, "/api/order-modifications/mod_missing", { headers: { cookie: posCookie } });
    assert.equal(pos.response.status, 404, "POS reaches the governed recovery boundary");
    assert.equal(pos.body.error.code, "ORDER_MODIFICATION_INTENT_NOT_FOUND");
    const kitchenCookie = await login(baseUrl, "kitchen.mod", "kitchen-modification-password");
    const kitchen = await request(baseUrl, "/api/order-modifications/mod_missing", { headers: { cookie: kitchenCookie } });
    assert.equal(kitchen.response.status, 403);
    assert.equal(kitchen.body.error.code, "authorization_forbidden");
  } finally {
    await closeServer(server, databasePath);
  }
});
