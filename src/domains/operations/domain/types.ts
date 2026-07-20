import type { ProductContractV2 } from "../../../shared/contracts/product-contract.js";

export const EVENT_STATUSES = ["draft", "open", "closed", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type OperationsEvent = Readonly<{
  eventId: string;
  eventCode: string;
  displayName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}>;

export type SellableInventory = Readonly<{
  eventId: string;
  productId: string;
  productVersionId: string;
  plannedQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  createdAt: string;
  updatedAt: string;
}>;

export type OperationsProductCopy = Readonly<ProductContractV2>;
export type EventProduct = Readonly<ProductContractV2 & { remainingQuantity: number }>;
