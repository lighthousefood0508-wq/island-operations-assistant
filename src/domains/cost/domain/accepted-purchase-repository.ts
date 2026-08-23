import type { AcceptedPurchase } from "./accepted-purchase.js";
export interface AcceptedPurchaseRepository { saveNew(acceptedPurchase: AcceptedPurchase, expectedPurchaseVersion: number): void; }
