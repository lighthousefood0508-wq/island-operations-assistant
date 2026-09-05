import type { OperationsOrder, PaymentMethod, ProductionStatus } from "./types.js";

export const ORDER_MODIFICATION_INTENT_STATES = [
  "prepared",
  "external_in_progress",
  "confirmed",
  "cancelled",
  "expired",
  "reconciliation_required"
] as const;

export type OrderModificationIntentState = (typeof ORDER_MODIFICATION_INTENT_STATES)[number];
export type OrderModificationOutcomeKind = "replacement" | "cancellation";
export type OrderModificationAdjustmentDirection = "none" | "supplement" | "refund";

export type OrderModificationItemInput = Readonly<{
  productId: string;
  productVersionId: string;
  quantity: number;
  notes: string | null;
}>;

export type OrderModificationDispositionInput = Readonly<{
  orderItemId: string;
  returnedToSellableQuantity: number;
  notReturnedQuantity: number;
  reason: string;
}>;

export type PrepareOrderModificationCommand = Readonly<{
  orderId: string;
  expectedRevision: string;
  idempotencyKey: string;
  items: readonly OrderModificationItemInput[];
  scheduledPickupAt: string | null;
  customerName: string | null;
  customerPhoneTail: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  supplementMethod: PaymentMethod | null;
  dispositions: readonly OrderModificationDispositionInput[];
  actor: string;
  deviceId: string;
}>;

export type FrozenOrderModificationLine = Readonly<{
  intentItemId: string;
  lineSequence: number;
  productId: string;
  productVersionId: string;
  displayNameSnapshot: string;
  posNameSnapshot: string;
  displayCategoryNameSnapshot: string | null;
  unitListPrice: number;
  unitSellingPrice: number;
  quantity: number;
  lineDiscount: number;
  lineTotal: number;
  notes: string | null;
  costStatus: "unavailable";
}>;

export type FrozenOrderModificationDisposition = Readonly<{
  sourceOrderItemId: string;
  productId: string;
  productVersionId: string;
  removedQuantity: number;
  returnedToSellableQuantity: number;
  notReturnedQuantity: number;
  reason: string;
}>;

export type OrderModificationIntent = Readonly<{
  intentId: string;
  eventId: string;
  rootOrderId: string;
  effectiveOrderId: string;
  expectedEffectiveRevision: string;
  state: OrderModificationIntentState;
  intentRevision: number;
  idempotencyKey: string;
  requestFingerprint: string;
  before: OperationsOrder;
  after: Readonly<{
    scheduledPickupAt: string | null;
    customerName: string | null;
    customerPhoneTail: string | null;
    paymentMethod: PaymentMethod | null;
    notes: string | null;
    productionStatus: ProductionStatus;
    items: readonly FrozenOrderModificationLine[];
  }>;
  difference: Readonly<{
    itemCountChanged: boolean;
    productionContentChanged: boolean;
    metadataChanged: boolean;
    reservations: readonly Readonly<{ productId: string; productVersionId: string; quantity: number }>[];
    dispositions: readonly FrozenOrderModificationDisposition[];
  }>;
  originalCollected: number;
  newTotal: number;
  adjustmentAmount: number;
  adjustmentDirection: OrderModificationAdjustmentDirection;
  adjustmentMethod: PaymentMethod | null;
  paymentBasisStatus: "unpaid" | "paid";
  outcomeKind: OrderModificationOutcomeKind;
  productionResetRequired: boolean;
  createdBy: string;
  deviceId: string;
  createdAt: string;
  expiresAt: string | null;
  lastRenewedAt: string | null;
  externalStartedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  reconciliationRequiredAt: string | null;
  transitionedBy: string | null;
  transitionReason: string | null;
}>;

export type OrderModificationPrepareResult = Readonly<{
  intent: OrderModificationIntent;
  replayed: boolean;
}>;
