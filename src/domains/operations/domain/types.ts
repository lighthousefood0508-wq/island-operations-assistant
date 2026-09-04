import type { ProductContractV2 } from "../../../shared/contracts/product-contract.js";

export const EVENT_STATUSES = ["draft", "open", "paused", "closed", "archived"] as const;
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
  safetyBufferQuantity: number;
  isEnabled: boolean;
  remainingQuantity: number;
  customerAvailableQuantity: number;
  createdAt: string;
  updatedAt: string;
}>;

export type OperationsProductCopy = Readonly<ProductContractV2>;
export type EventProduct = Readonly<ProductContractV2 & { remainingQuantity: number; safetyBufferQuantity: number; customerAvailableQuantity: number }>;
export type SellableInventoryView = Readonly<SellableInventory & Partial<ProductContractV2>>;

export type PosOrderItemInput = Readonly<{
  productId: string;
  productVersionId: string;
  quantity: number;
  notes: string | null;
}>;

export type CreatePosOrderInput = Readonly<{
  source: "pos";
  eventId: string;
  idempotencyKey: string;
  items: readonly PosOrderItemInput[];
  // ScheduledPickupOrderLifecycleBoundary: validated Event-local command instant.
  scheduledPickupAt: string | null;
  paymentCollected: boolean;
  customerName: string | null;
  customerPhoneTail: string | null;
  paymentMethod: PaymentMethod | null;
  operator: string;
  deviceId: string;
  notes: string | null;
}>;

export type OrderItem = Readonly<{
  orderItemId: string;
  productId: string;
  productVersionId: string;
  displayNameSnapshot: string;
  posNameSnapshot: string;
  posName: string;
  displayCategoryNameSnapshot: string | null;
  unitListPrice: number;
  unitSellingPrice: number;
  quantity: number;
  lineDiscount: number;
  lineTotal: number;
  notes: string | null;
  costStatus: "unavailable";
}>;

export type OperationsOrder = Readonly<{
  orderId: string;
  orderNumber: string;
  eventId: string;
  source: "pos";
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  cancellationReason: string | null;
  scheduledPickupAt: string | null;
  customerName: string | null;
  customerPhoneTail: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  paidTotal: number;
  createdAt: string;
  confirmedAt: string;
  servedAt: string | null;
  revision: string;
  items: readonly OrderItem[];
}>;

export const ORDER_STATUSES = ["draft", "submitted", "confirmed", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "partially_refunded", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "LINE_PAY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type OperationsPayment = Readonly<{
  paymentId: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: "paid";
  amount: number;
  paidAt: string;
  operator: string;
  deviceId: string;
  identityTrust: "client_reported";
}>;

export type ConfirmPaymentResult = Readonly<{
  order: OperationsOrder;
  payment: OperationsPayment;
  replayed: boolean;
}>;

export type PaymentCloseoutReconciliation = Readonly<{
  expected: Readonly<{ cash: number; linePay: number }>;
  declared: Readonly<{ cash: number; linePay: number; other: number }>;
  variance: Readonly<{ cash: number; linePay: number }>;
  outcome: "matched" | "exception_accepted";
  exception: Readonly<{ reason: string; actor: string }> | null;
}>;

export const PRODUCTION_STATUSES = ["not_started", "queued", "preparing", "ready", "served", "cancelled"] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export type DailyReport = Readonly<{
  event: Readonly<{ eventId: string; eventCode: string; displayName: string; date: string; startTime: string; endTime: string }>;
  orders: Readonly<{ total: number; completed: number; cancelled: number; noShow: number }>;
  products: readonly Readonly<{ productId: string; posName: string; quantity: number; revenue: number }>[];
  payments: Readonly<{ cash: number; linePay: number; other: number }>;
  // PaymentCloseoutReconciliationBoundary: immutable once Event Close succeeds.
  paymentReconciliation: PaymentCloseoutReconciliation | null;
  closedAt: string;
}>;
