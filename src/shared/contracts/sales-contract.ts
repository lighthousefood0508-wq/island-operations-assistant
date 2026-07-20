import {
  optionalNonEmptyString,
  optionalNonNegativeInteger,
  requireExactKeys,
  requireIsoTimestamp,
  requireNonEmptyString,
  requireNonNegativeInteger,
  requirePositiveInteger,
  requireRecord
} from "./validation.js";

export const SALES_CONTRACT_VERSION = "1" as const;

export type SalesContractItemV1 = Readonly<{
  productId: string;
  productVersionId: string;
  quantity: number;
  unitPrice: number;
}>;

export type SalesContractV1 = Readonly<{
  contractVersion: typeof SALES_CONTRACT_VERSION;
  salesEventId: string;
  orderId: string;
  eventId: string;
  completedAt: string;
  items: readonly SalesContractItemV1[];
  discountAmount?: number;
  channel?: string;
  notes?: string;
}>;

const contractKeys = [
  "contractVersion",
  "salesEventId",
  "orderId",
  "eventId",
  "completedAt",
  "items",
  "discountAmount",
  "channel",
  "notes"
] as const;
const itemKeys = ["productId", "productVersionId", "quantity", "unitPrice"] as const;

function parseItem(value: unknown, index: number): SalesContractItemV1 {
  const record = requireRecord(value, `Sales Contract items[${index}]`);
  requireExactKeys(record, itemKeys, `Sales Contract items[${index}]`);
  return Object.freeze({
    productId: requireNonEmptyString(record.productId, `items[${index}].productId`),
    productVersionId: requireNonEmptyString(record.productVersionId, `items[${index}].productVersionId`),
    quantity: requirePositiveInteger(record.quantity, `items[${index}].quantity`),
    unitPrice: requireNonNegativeInteger(record.unitPrice, `items[${index}].unitPrice`)
  });
}

export function parseSalesContract(value: unknown): SalesContractV1 {
  const record = requireRecord(value, "Sales Contract");
  requireExactKeys(record, contractKeys, "Sales Contract");
  if (record.contractVersion !== SALES_CONTRACT_VERSION) {
    throw new TypeError(`Unsupported Sales Contract version: ${String(record.contractVersion)}.`);
  }
  if (!Array.isArray(record.items) || record.items.length === 0) {
    throw new TypeError("Sales Contract items must be a non-empty array.");
  }
  const result: {
    contractVersion: typeof SALES_CONTRACT_VERSION;
    salesEventId: string;
    orderId: string;
    eventId: string;
    completedAt: string;
    items: readonly SalesContractItemV1[];
    discountAmount?: number;
    channel?: string;
    notes?: string;
  } = {
    contractVersion: SALES_CONTRACT_VERSION,
    salesEventId: requireNonEmptyString(record.salesEventId, "salesEventId"),
    orderId: requireNonEmptyString(record.orderId, "orderId"),
    eventId: requireNonEmptyString(record.eventId, "eventId"),
    completedAt: requireIsoTimestamp(record.completedAt, "completedAt"),
    items: Object.freeze(record.items.map(parseItem))
  };
  const discountAmount = optionalNonNegativeInteger(record.discountAmount, "discountAmount");
  const channel = optionalNonEmptyString(record.channel, "channel");
  const notes = optionalNonEmptyString(record.notes, "notes");
  if (discountAmount !== undefined) result.discountAmount = discountAmount;
  if (channel !== undefined) result.channel = channel;
  if (notes !== undefined) result.notes = notes;
  return Object.freeze(result) as SalesContractV1;
}
