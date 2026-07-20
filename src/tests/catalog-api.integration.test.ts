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

test("Admin publish flows through Product Contract API for POS", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `catalog-api-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { code: "rice", displayName: "飯類", sortOrder: 1, isActive: true });
  assert.equal(category.status, 201);
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "燉肉飯", categoryId: category.body.data.categoryId, displayName: "燉肉飯", posName: "燉肉", sellingPrice: 120, channels: ["pos"] });
  assert.equal(product.status, 201);
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  assert.equal(published.status, 200);
  assert.equal(published.body.data.contract.contractVersion, "1");
  const posProducts = await request(baseUrl, "/api/catalog/products/published?channel=pos");
  assert.equal(posProducts.status, 200);
  assert.equal(posProducts.body.data.length, 1);
  assert.equal(posProducts.body.data[0].posName, "燉肉");
  server.close();
  await once(server, "close");
});
