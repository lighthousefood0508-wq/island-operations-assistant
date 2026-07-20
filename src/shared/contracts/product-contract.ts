import {
  requireBoolean,
  requireExactKeys,
  requireIsoTimestamp,
  requireNonEmptyString,
  requireNonNegativeInteger,
  requireRecord
} from "./validation.js";

export const PRODUCT_CONTRACT_VERSION = "1" as const;

export type ProductContractV1 = Readonly<{
  contractVersion: typeof PRODUCT_CONTRACT_VERSION;
  productId: string;
  productVersionId: string;
  categoryId: string;
  displayName: string;
  posName: string;
  sellingPrice: number;
  channels: readonly string[];
  isActive: boolean;
  publishedAt: string;
}>;

const allowedKeys = [
  "contractVersion",
  "productId",
  "productVersionId",
  "categoryId",
  "displayName",
  "posName",
  "sellingPrice",
  "channels",
  "isActive",
  "publishedAt"
] as const;

export function parseProductContract(value: unknown): ProductContractV1 {
  const record = requireRecord(value, "Product Contract");
  requireExactKeys(record, allowedKeys, "Product Contract");
  if (record.contractVersion !== PRODUCT_CONTRACT_VERSION) {
    throw new TypeError(`Unsupported Product Contract version: ${String(record.contractVersion)}.`);
  }
  if (!Array.isArray(record.channels) || record.channels.length === 0) {
    throw new TypeError("Product Contract channels must be a non-empty array.");
  }
  const channels = record.channels.map((channel, index) => requireNonEmptyString(channel, `channels[${index}]`));
  return Object.freeze({
    contractVersion: PRODUCT_CONTRACT_VERSION,
    productId: requireNonEmptyString(record.productId, "productId"),
    productVersionId: requireNonEmptyString(record.productVersionId, "productVersionId"),
    categoryId: requireNonEmptyString(record.categoryId, "categoryId"),
    displayName: requireNonEmptyString(record.displayName, "displayName"),
    posName: requireNonEmptyString(record.posName, "posName"),
    sellingPrice: requireNonNegativeInteger(record.sellingPrice, "sellingPrice"),
    channels: Object.freeze(channels),
    isActive: requireBoolean(record.isActive, "isActive"),
    publishedAt: requireIsoTimestamp(record.publishedAt, "publishedAt")
  });
}
