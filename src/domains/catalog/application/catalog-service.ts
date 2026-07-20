import { HttpError } from "../../../shared/errors/http-error.js";
import { parseProductContract, type ProductContractV1 } from "../../../shared/contracts/product-contract.js";
import { createId } from "../../../shared/utils/ids.js";
import { CATALOG_CHANNELS, type CatalogChannel, type CatalogProduct, type Category, type ProductDraft, type ProductStatus, type ProductVersion } from "../domain/types.js";
import { CatalogRepository } from "../infrastructure/catalog-repository.js";

export type CreateCategoryInput = Readonly<{ code: string; displayName: string; sortOrder?: number; isActive?: boolean }>;
export type UpdateCategoryInput = Readonly<Partial<CreateCategoryInput>>;
export type CreateProductInput = Readonly<{
  internalName: string;
  categoryId: string;
  displayName?: string;
  posName?: string;
  sellingPrice?: number;
  description?: string | null;
  channels?: readonly string[];
}>;
export type UpdateProductInput = Readonly<{
  internalName?: string;
  categoryId?: string;
  status?: "draft" | "inactive" | "published";
  displayName?: string;
  posName?: string;
  sellingPrice?: number;
  description?: string | null;
  channels?: readonly string[];
}>;

function now(): string { return new Date().toISOString(); }
function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new HttpError(422, "validation_error", `${field} is required.`, { field });
  return value.trim();
}
function requireNonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new HttpError(422, "validation_error", `${field} must be a non-negative integer.`, { field });
  return value as number;
}
function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new HttpError(422, "validation_error", `${field} must be a boolean.`, { field });
  return value;
}
function draftText(value: unknown, field: string): string | null {
  if (typeof value !== "string") throw new HttpError(422, "validation_error", `${field} must be a string.`, { field });
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}
function channelsFrom(value: readonly string[]): CatalogChannel[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(422, "validation_error", "At least one channel is required.", { field: "channels" });
  const unique = [...new Set(value)];
  for (const channel of unique) {
    if (!CATALOG_CHANNELS.includes(channel as CatalogChannel)) throw new HttpError(422, "validation_error", `Unsupported channel: ${channel}.`, { field: "channels" });
  }
  return unique as CatalogChannel[];
}
function validateChannels(value: readonly string[]): CatalogChannel[] {
  const unique = [...new Set(value)];
  for (const channel of unique) {
    if (!CATALOG_CHANNELS.includes(channel as CatalogChannel)) throw new HttpError(422, "validation_error", `Unsupported channel: ${channel}.`, { field: "channels" });
  }
  return unique as CatalogChannel[];
}

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listCategories(): Category[] { return this.repository.listCategories(); }
  listProducts(): CatalogProduct[] { return this.repository.listProducts(); }

  createCategory(input: CreateCategoryInput): Category {
    const timestamp = now();
    const code = requireText(input.code, "code").toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(code)) throw new HttpError(422, "validation_error", "code may contain lowercase letters, numbers, underscores, and hyphens only.", { field: "code" });
    if (this.repository.findCategoryByCode(code)) throw new HttpError(409, "category_code_conflict", "Category code already exists.", { field: "code" });
    const category: Category = { categoryId: createId("cat_"), code, displayName: requireText(input.displayName, "displayName"), sortOrder: input.sortOrder === undefined ? 0 : requireNonNegativeInteger(input.sortOrder, "sortOrder"), isActive: input.isActive === undefined ? true : requireBoolean(input.isActive, "isActive"), createdAt: timestamp, updatedAt: timestamp };
    this.repository.transaction(() => { this.repository.insertCategory(category); this.audit("category", category.categoryId, "category.created", category); });
    return category;
  }

  updateCategory(categoryId: string, input: UpdateCategoryInput): Category {
    const existing = this.repository.findCategory(categoryId);
    if (!existing) throw new HttpError(404, "category_not_found", "Category was not found.");
    const code = input.code === undefined ? existing.code : requireText(input.code, "code").toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(code)) throw new HttpError(422, "validation_error", "code may contain lowercase letters, numbers, underscores, and hyphens only.", { field: "code" });
    const codeOwner = this.repository.findCategoryByCode(code);
    if (codeOwner && codeOwner.categoryId !== categoryId) throw new HttpError(409, "category_code_conflict", "Category code already exists.", { field: "code" });
    const category: Category = { ...existing, code, displayName: input.displayName === undefined ? existing.displayName : requireText(input.displayName, "displayName"), sortOrder: input.sortOrder === undefined ? existing.sortOrder : requireNonNegativeInteger(input.sortOrder, "sortOrder"), isActive: input.isActive === undefined ? existing.isActive : requireBoolean(input.isActive, "isActive"), updatedAt: now() };
    this.repository.transaction(() => { this.repository.updateCategory(category); this.audit("category", category.categoryId, "category.updated", category); });
    return category;
  }

  createProduct(input: CreateProductInput): CatalogProduct {
    const category = this.requireCategory(input.categoryId);
    const timestamp = now();
    const draft: ProductDraft = { displayName: null, posName: null, sellingPrice: null, description: null, channels: [], updatedAt: timestamp };
    const product: Omit<CatalogProduct, "versions"> = { productId: createId("prod_"), internalName: requireText(input.internalName, "internalName"), categoryId: category.categoryId, status: "draft", createdAt: timestamp, updatedAt: timestamp, draft };
    this.repository.transaction(() => { this.repository.insertProduct(product); this.audit("product", product.productId, "product.created", product); });
    return this.updateProduct(product.productId, input);
  }

  updateProduct(productId: string, input: UpdateProductInput): CatalogProduct {
    const existing = this.getProduct(productId);
    const categoryId = input.categoryId === undefined ? existing.categoryId : this.requireCategory(input.categoryId).categoryId;
    if (input.status === "published" && existing.status !== "published" && existing.versions.length === 0) {
      throw new HttpError(422, "publish_required", "Use the publish action to create the first published version.");
    }
    const status: ProductStatus = input.status === undefined ? existing.status : input.status;
    const channels = input.channels === undefined ? [...existing.draft.channels] : validateChannels(input.channels);
    const draft: ProductDraft = {
      displayName: input.displayName === undefined ? existing.draft.displayName : draftText(input.displayName, "displayName"),
      posName: input.posName === undefined ? existing.draft.posName : draftText(input.posName, "posName"),
      sellingPrice: input.sellingPrice === undefined ? existing.draft.sellingPrice : requireNonNegativeInteger(input.sellingPrice, "sellingPrice"),
      description: input.description === undefined ? existing.draft.description : input.description === null ? null : draftText(input.description, "description"),
      channels,
      updatedAt: now()
    };
    const product: CatalogProduct = { ...existing, categoryId, internalName: input.internalName === undefined ? existing.internalName : requireText(input.internalName, "internalName"), status, updatedAt: draft.updatedAt, draft };
    this.repository.transaction(() => { this.repository.updateProduct(product); this.audit("product", productId, "product.updated", product); });
    return this.getProduct(productId);
  }

  publishProduct(productId: string): { product: CatalogProduct; contract: ProductContractV1; version: ProductVersion } {
    const product = this.getProduct(productId);
    const category = this.requireCategory(product.categoryId);
    if (!category.isActive) throw new HttpError(422, "category_inactive", "A product cannot be published under an inactive category.");
    const draft = product.draft;
    const displayName = requireText(draft.displayName, "displayName");
    const posName = requireText(draft.posName, "posName");
    const sellingPrice = requireNonNegativeInteger(draft.sellingPrice, "sellingPrice");
    const channels = channelsFrom(draft.channels);
    const publishedAt = now();
    const version: ProductVersion = { productVersionId: createId("pver_"), versionNumber: this.repository.nextVersionNumber(productId), displayName, posName, sellingPrice, description: draft.description, publishedAt, channels };
    const updated: CatalogProduct = { ...product, status: "published", updatedAt: publishedAt };
    const contract = this.toContract(updated, category, version);
    this.repository.transaction(() => {
      this.repository.insertVersion(version, productId);
      this.repository.updateProduct(updated);
      this.audit("product", productId, "product.published", { product: updated, version, contract });
    });
    return { product: this.getProduct(productId), contract, version };
  }

  getPublishedProducts(channel?: string): ProductContractV1[] {
    if (channel !== undefined && !CATALOG_CHANNELS.includes(channel as CatalogChannel)) throw new HttpError(422, "validation_error", "Unsupported channel.", { field: "channel" });
    return this.repository.listPublishedProducts(channel as CatalogChannel | undefined).map(({ productId, category, version }) => this.toContract({ productId, categoryId: category.categoryId, status: "published" }, category, version));
  }

  getProduct(productId: string): CatalogProduct {
    const product = this.repository.findProduct(productId);
    if (!product) throw new HttpError(404, "product_not_found", "Product was not found.");
    return product;
  }

  private requireCategory(categoryId: string): Category {
    const category = this.repository.findCategory(categoryId);
    if (!category) throw new HttpError(422, "category_not_found", "Category was not found.", { field: "categoryId" });
    return category;
  }

  private toContract(product: Pick<CatalogProduct, "productId" | "categoryId" | "status">, category: Category, version: ProductVersion): ProductContractV1 {
    return parseProductContract({ contractVersion: "1", productId: product.productId, productVersionId: version.productVersionId, categoryId: category.categoryId, displayName: version.displayName, posName: version.posName, sellingPrice: version.sellingPrice, channels: version.channels, isActive: product.status === "published" && category.isActive, publishedAt: version.publishedAt });
  }

  private audit(entityType: string, entityId: string, action: string, payload: unknown): void {
    this.repository.recordAudit(entityType, entityId, action, now(), JSON.stringify(payload));
  }
}
