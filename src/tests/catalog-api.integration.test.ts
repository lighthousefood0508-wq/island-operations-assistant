import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";

async function request(baseUrl: string, pathname: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

test("Category API generates stable codes and rejects caller supplied codes", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `catalog-api-code-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const first = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "飯類", sortOrder: 1, isActive: true });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.code, "cat-0001");
  const supplied = await request(baseUrl, "/api/admin/categories", "POST", { code: "manual", displayName: "手動代碼" });
  assert.equal(supplied.status, 422);
  assert.equal(supplied.body.error.code, "validation_error");
  const updated = await request(baseUrl, `/api/admin/categories/${first.body.data.categoryId}`, "PATCH", { displayName: "飯盒", sortOrder: 2, isActive: false });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.code, "cat-0001");
  assert.equal(updated.body.data.displayName, "飯盒");
  assert.equal(updated.body.data.isActive, false);
  assert.equal((await request(baseUrl, `/api/admin/categories/${first.body.data.categoryId}`, "PATCH", { code: "cat-9999" })).status, 422);
  assert.equal((await request(baseUrl, `/api/admin/categories/${first.body.data.categoryId}`, "PATCH", { categoryId: "other" })).status, 422);
  server.close();
  await once(server, "close");
});

test("Category API concurrent creates produce unique generated codes", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `catalog-api-concurrent-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const [left, right] = await Promise.all([
    request(baseUrl, "/api/admin/categories", "POST", { displayName: "飯類", sortOrder: 1 }),
    request(baseUrl, "/api/admin/categories", "POST", { displayName: "小菜", sortOrder: 2 })
  ]);
  assert.equal(left.status, 201);
  assert.equal(right.status, 201);
  assert.deepEqual([left.body.data.code, right.body.data.code].sort(), ["cat-0001", "cat-0002"]);
  assert.match(left.body.data.code, /^cat-[0-9]{4}$/);
  assert.match(right.body.data.code, /^cat-[0-9]{4}$/);
  server.close();
  await once(server, "close");
});

test("Admin publish flows through Product Contract API for POS", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `catalog-api-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "飯類", sortOrder: 1, isActive: true });
  assert.equal(category.status, 201);
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "燉肉飯", categoryId: category.body.data.categoryId, displayName: "燉肉飯", posName: "燉肉", sellingPrice: 120, channels: ["pos"] });
  assert.equal(product.status, 201);
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  assert.equal(published.status, 200);
  assert.equal(published.body.data.contract.contractVersion, "2");
  assert.equal(published.body.data.contract.displayCategoryName, "飯類");
  const posProducts = await request(baseUrl, "/api/catalog/products/published?channel=pos");
  assert.equal(posProducts.status, 200);
  assert.equal(posProducts.body.data.length, 1);
  assert.equal(posProducts.body.data[0].posName, "燉肉");
  server.close();
  await once(server, "close");
});
