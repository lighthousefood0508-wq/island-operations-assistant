import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import { createId } from "../../../shared/utils/ids.js";
import type { CatalogChannel, Category, CatalogProduct, ProductDraft, ProductStatus, ProductVersion } from "../domain/types.js";

type CategoryRow = {
  category_id: string; code: string; display_name: string; sort_order: number; is_active: number; created_at: string; updated_at: string;
};
type ProductRow = {
  product_id: string; internal_name: string; category_id: string; status: ProductStatus; created_at: string; updated_at: string;
};
type DraftRow = {
  display_name: string | null; pos_name: string | null; selling_price: number | null; description: string | null; updated_at: string;
};
type VersionRow = {
  product_version_id: string; version_number: number; display_name: string; pos_name: string; selling_price: number; description: string | null; published_at: string | null;
};

function mapCategory(row: CategoryRow): Category {
  return { categoryId: row.category_id, code: row.code, displayName: row.display_name, sortOrder: row.sort_order, isActive: row.is_active === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class CatalogRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  transaction<T>(work: () => T): T { return this.database.transaction(work); }
  transactionImmediate<T>(work: () => T): T { return this.database.transactionImmediate(work); }

  listCategories(): Category[] {
    return this.database.queryMany<CategoryRow>("SELECT category_id, code, display_name, sort_order, is_active, created_at, updated_at FROM catalog_categories ORDER BY sort_order, display_name").map(mapCategory);
  }

  findCategory(categoryId: string): Category | undefined {
    const row = this.database.queryOne<CategoryRow>("SELECT category_id, code, display_name, sort_order, is_active, created_at, updated_at FROM catalog_categories WHERE category_id = ?", [categoryId]);
    return row ? mapCategory(row) : undefined;
  }

  findCategoryByCode(code: string): Category | undefined {
    const row = this.database.queryOne<CategoryRow>("SELECT category_id, code, display_name, sort_order, is_active, created_at, updated_at FROM catalog_categories WHERE code = ?", [code]);
    return row ? mapCategory(row) : undefined;
  }

  nextGeneratedCategoryCodeNumber(): number {
    const row = this.database.queryOne<{ next_number: number }>(
      "SELECT COALESCE(MAX(CAST(SUBSTR(code, 5) AS INTEGER)), 0) + 1 AS next_number FROM catalog_categories WHERE code GLOB 'cat-[0-9][0-9][0-9][0-9]'"
    );
    return row?.next_number ?? 1;
  }

  insertCategory(category: Category): void {
    this.database.execute("INSERT INTO catalog_categories (category_id, code, display_name, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [category.categoryId, category.code, category.displayName, category.sortOrder, category.isActive ? 1 : 0, category.createdAt, category.updatedAt]);
  }

  updateCategory(category: Category): void {
    this.database.execute("UPDATE catalog_categories SET display_name = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE category_id = ?", [category.displayName, category.sortOrder, category.isActive ? 1 : 0, category.updatedAt, category.categoryId]);
  }

  insertProduct(product: Omit<CatalogProduct, "versions">): void {
    this.database.execute("INSERT INTO catalog_products (product_id, category_id, internal_name, lifecycle_status, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)", [product.productId, product.categoryId, product.internalName, product.status, product.createdAt, product.updatedAt]);
    this.database.execute("INSERT INTO catalog_product_drafts (product_id, display_name, pos_name, selling_price, description, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [product.productId, product.draft.displayName, product.draft.posName, product.draft.sellingPrice, product.draft.description, product.draft.updatedAt]);
  }

  updateProduct(product: CatalogProduct): void {
    this.database.execute("UPDATE catalog_products SET category_id = ?, internal_name = ?, status = ?, updated_at = ? WHERE product_id = ?", [product.categoryId, product.internalName, product.status, product.updatedAt, product.productId]);
    this.database.execute("UPDATE catalog_product_drafts SET display_name = ?, pos_name = ?, selling_price = ?, description = ?, updated_at = ? WHERE product_id = ?", [product.draft.displayName, product.draft.posName, product.draft.sellingPrice, product.draft.description, product.draft.updatedAt, product.productId]);
    this.database.execute("DELETE FROM catalog_product_draft_channels WHERE product_id = ?", [product.productId]);
    for (const channel of product.draft.channels) {
      this.database.execute("INSERT INTO catalog_product_draft_channels (product_id, channel, is_enabled, updated_at) VALUES (?, ?, 1, ?)", [product.productId, channel, product.draft.updatedAt]);
    }
  }

  findProduct(productId: string): CatalogProduct | undefined {
    const product = this.database.queryOne<ProductRow>("SELECT product_id, internal_name, category_id, status, created_at, updated_at FROM catalog_products WHERE product_id = ?", [productId]);
    return product ? this.hydrateProduct(product) : undefined;
  }

  listProducts(): CatalogProduct[] {
    return this.database.queryMany<ProductRow>("SELECT product_id, internal_name, category_id, status, created_at, updated_at FROM catalog_products ORDER BY updated_at DESC").map((product) => this.hydrateProduct(product));
  }

  insertVersion(version: ProductVersion, productId: string): void {
    this.database.execute("INSERT INTO catalog_product_versions (product_version_id, product_id, version_number, display_name, pos_name, selling_price, is_active, published_at, created_at, description) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)", [version.productVersionId, productId, version.versionNumber, version.displayName, version.posName, version.sellingPrice, version.publishedAt, version.publishedAt, version.description]);
    for (const channel of version.channels) {
      this.database.execute("INSERT INTO catalog_product_channels (product_channel_id, product_version_id, channel, is_enabled, created_at) VALUES (?, ?, ?, 1, ?)", [`pchan_${version.productVersionId}_${channel}`, version.productVersionId, channel, version.publishedAt]);
    }
  }

  nextVersionNumber(productId: string): number {
    const row = this.database.queryOne<{ next_version: number }>("SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM catalog_product_versions WHERE product_id = ?", [productId]);
    return row?.next_version ?? 1;
  }

  recordAudit(entityType: string, entityId: string, action: string, occurredAt: string, afterJson: string): void {
    this.database.execute("INSERT INTO audit_logs (audit_log_id, entity_type, entity_id, action, after_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)", [createId("audit_"), entityType, entityId, action, afterJson, occurredAt]);
  }

  listPublishedProducts(channel?: CatalogChannel): Array<{ category: Category; version: ProductVersion; productId: string }> {
    const rows = this.database.queryMany<VersionRow & { product_id: string; category_id: string; category_code: string; category_display_name: string; category_sort_order: number; category_is_active: number; category_created_at: string; category_updated_at: string }>(
      `SELECT p.product_id, p.category_id, c.code AS category_code, c.display_name AS category_display_name, c.sort_order AS category_sort_order, c.is_active AS category_is_active, c.created_at AS category_created_at, c.updated_at AS category_updated_at,
        v.product_version_id, v.version_number, v.display_name, v.pos_name, v.selling_price, v.description, v.published_at
       FROM catalog_products p
       JOIN catalog_categories c ON c.category_id = p.category_id
       JOIN catalog_product_versions v ON v.product_id = p.product_id
       WHERE p.status = 'published' AND c.is_active = 1 AND v.published_at IS NOT NULL
         AND v.version_number = (SELECT MAX(latest.version_number) FROM catalog_product_versions latest WHERE latest.product_id = p.product_id AND latest.published_at IS NOT NULL)
       ORDER BY c.sort_order, v.display_name`
    );
    return rows.map((row) => {
      const channels = this.channelsForVersion(row.product_version_id);
      const version: ProductVersion = { productVersionId: row.product_version_id, versionNumber: row.version_number, displayName: row.display_name, posName: row.pos_name, sellingPrice: row.selling_price, description: row.description, publishedAt: row.published_at, channels };
      const category: Category = { categoryId: row.category_id, code: row.category_code, displayName: row.category_display_name, sortOrder: row.category_sort_order, isActive: row.category_is_active === 1, createdAt: row.category_created_at, updatedAt: row.category_updated_at };
      return { category, version, productId: row.product_id };
    }).filter((entry) => channel === undefined || entry.version.channels.includes(channel));
  }

  private hydrateProduct(product: ProductRow): CatalogProduct {
    const draftRow = this.database.queryOne<DraftRow>("SELECT display_name, pos_name, selling_price, description, updated_at FROM catalog_product_drafts WHERE product_id = ?", [product.product_id]);
    const draft: ProductDraft = { displayName: draftRow?.display_name ?? null, posName: draftRow?.pos_name ?? null, sellingPrice: draftRow?.selling_price ?? null, description: draftRow?.description ?? null, channels: this.draftChannels(product.product_id), updatedAt: draftRow?.updated_at ?? product.updated_at };
    const versions = this.database.queryMany<VersionRow>("SELECT product_version_id, version_number, display_name, pos_name, selling_price, description, published_at FROM catalog_product_versions WHERE product_id = ? ORDER BY version_number DESC", [product.product_id]).map((row) => ({ productVersionId: row.product_version_id, versionNumber: row.version_number, displayName: row.display_name, posName: row.pos_name, sellingPrice: row.selling_price, description: row.description, publishedAt: row.published_at, channels: this.channelsForVersion(row.product_version_id) }));
    return { productId: product.product_id, internalName: product.internal_name, categoryId: product.category_id, status: product.status, createdAt: product.created_at, updatedAt: product.updated_at, draft, versions };
  }

  private draftChannels(productId: string): CatalogChannel[] {
    return this.database.queryMany<{ channel: CatalogChannel }>("SELECT channel FROM catalog_product_draft_channels WHERE product_id = ? AND is_enabled = 1 ORDER BY channel", [productId]).map((row) => row.channel);
  }

  private channelsForVersion(productVersionId: string): CatalogChannel[] {
    return this.database.queryMany<{ channel: CatalogChannel }>("SELECT channel FROM catalog_product_channels WHERE product_version_id = ? AND is_enabled = 1 ORDER BY channel", [productVersionId]).map((row) => row.channel);
  }
}
