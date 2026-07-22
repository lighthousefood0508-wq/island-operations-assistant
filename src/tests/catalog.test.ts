import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { CatalogRepository, CatalogService } from "../domains/catalog/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import { HttpError } from "../shared/errors/http-error.js";

function createCatalogFixture() {
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `catalog-test-${randomUUID()}.sqlite`) });
  runMigrations(database);
  return { database, service: new CatalogService(new CatalogRepository(database)) };
}

test("Database Adapter rolls back a failed transaction", () => {
  const { database } = createCatalogFixture();
  assert.throws(() => database.transaction(() => {
    database.execute("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)", ["rollback", "no", new Date().toISOString()]);
    throw new Error("rollback");
  }));
  assert.equal(database.queryOne("SELECT setting_key FROM system_settings WHERE setting_key = ?", ["rollback"]), undefined);
  database.close();
});

test("Catalog generates stable category codes and rejects caller-provided codes", () => {
  const { database, service } = createCatalogFixture();
  const category = service.createCategory({ displayName: "飯類", sortOrder: 2 });
  assert.match(category.categoryId, /^cat_/);
  assert.equal(category.code, "cat-0001");
  const second = service.createCategory({ displayName: "小菜", sortOrder: 3 });
  assert.equal(second.code, "cat-0002");
  assert.throws(() => service.createCategory({ code: "manual", displayName: "手動代碼" } as never), (error) => error instanceof HttpError && error.code === "validation_error");
  database.close();
});

test("Catalog keeps legacy category codes and generates only from cat-number codes", () => {
  const { database, service } = createCatalogFixture();
  const timestamp = new Date().toISOString();
  database.execute("INSERT INTO catalog_categories (category_id, code, display_name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ["cat_legacy", "bento", "荒島飯盒", 1, 1, timestamp, timestamp]);
  database.execute("INSERT INTO catalog_categories (category_id, code, display_name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ["cat_numbered", "cat-0007", "流水分類", 2, 1, timestamp, timestamp]);
  const category = service.createCategory({ displayName: "新分類" });
  assert.equal(category.code, "cat-0008");
  assert.equal(service.listCategories().find((item) => item.categoryId === "cat_legacy")?.code, "bento");
  database.close();
});

test("Catalog category code is immutable after creation", () => {
  const { database, service } = createCatalogFixture();
  const category = service.createCategory({ displayName: "飯類", sortOrder: 2 });
  const updated = service.updateCategory(category.categoryId, { displayName: "飯盒", sortOrder: 5, isActive: false });
  assert.equal(updated.categoryId, category.categoryId);
  assert.equal(updated.code, category.code);
  assert.equal(updated.displayName, "飯盒");
  assert.equal(updated.sortOrder, 5);
  assert.equal(updated.isActive, false);
  assert.throws(() => service.updateCategory(category.categoryId, { code: "cat-9999" } as never), (error) => error instanceof HttpError && error.code === "validation_error");
  assert.throws(() => service.updateCategory(category.categoryId, { categoryId: "other" } as never), (error) => error instanceof HttpError && error.code === "validation_error");
  assert.equal(service.getPublishedProducts().length, 0);
  database.close();
});

test("Catalog category code generation stops at cat-9999", () => {
  const { database, service } = createCatalogFixture();
  const timestamp = new Date().toISOString();
  database.execute("INSERT INTO catalog_categories (category_id, code, display_name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ["cat_full", "cat-9999", "最後分類", 1, 1, timestamp, timestamp]);
  assert.throws(() => service.createCategory({ displayName: "超過上限" }), (error) => error instanceof HttpError && error.code === "category_code_exhausted");
  database.close();
});

test("Catalog category code unique index remains the final protection", () => {
  const { database, service } = createCatalogFixture();
  const category = service.createCategory({ displayName: "飯類" });
  const timestamp = new Date().toISOString();
  assert.throws(() => database.execute("INSERT INTO catalog_categories (category_id, code, display_name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ["cat_duplicate", category.code, "重複", 1, 1, timestamp, timestamp]));
  database.close();
});

test("Catalog creates a draft and requires complete fields before publishing", () => {
  const { database, service } = createCatalogFixture();
  const category = service.createCategory({ displayName: "飯類" });
  const product = service.createProduct({ internalName: "燉肉飯", categoryId: category.categoryId });
  assert.equal(product.status, "draft");
  assert.throws(() => service.publishProduct(product.productId));
  database.close();
});

test("Publishing creates immutable versions and valid Product Contracts", () => {
  const { database, service } = createCatalogFixture();
  const category = service.createCategory({ displayName: "飯類" });
  const product = service.createProduct({ internalName: "燉肉飯", categoryId: category.categoryId, displayName: "燉肉飯", posName: "燉肉", sellingPrice: 120, channels: ["pos", "preorder"] });
  const first = service.publishProduct(product.productId);
  assert.equal(first.version.versionNumber, 1);
  assert.deepEqual(Object.keys(first.contract).sort(), ["categoryId", "channels", "contractVersion", "displayCategoryName", "displayCategorySortOrder", "displayName", "isActive", "posName", "productId", "productVersionId", "publishedAt", "sellingPrice"].sort());
  assert.throws(() => database.execute("UPDATE catalog_product_versions SET display_name = ? WHERE product_version_id = ?", ["不可改", first.version.productVersionId]));
  service.updateProduct(product.productId, { displayName: "新版燉肉飯", posName: "燉肉新版", sellingPrice: 130, channels: ["pos"] });
  const second = service.publishProduct(product.productId);
  assert.equal(second.version.versionNumber, 2);
  database.close();
});

test("Published Product Contract filters channels for POS", () => {
  const { database, service } = createCatalogFixture();
  const category = service.createCategory({ displayName: "飯類" });
  const posProduct = service.createProduct({ internalName: "POS 商品", categoryId: category.categoryId, displayName: "POS 商品", posName: "POS", sellingPrice: 100, channels: ["pos"] });
  const preorderProduct = service.createProduct({ internalName: "預訂商品", categoryId: category.categoryId, displayName: "預訂商品", posName: "預訂", sellingPrice: 110, channels: ["preorder"] });
  service.publishProduct(posProduct.productId);
  service.publishProduct(preorderProduct.productId);
  const products = service.getPublishedProducts("pos");
  assert.equal(products.length, 1);
  assert.equal(products[0]?.posName, "POS");
  assert.equal("description" in (products[0] ?? {}), false);
  database.close();
});
