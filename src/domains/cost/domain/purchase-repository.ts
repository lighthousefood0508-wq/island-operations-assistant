import type { PurchaseId } from "./identities.js";
import type { CostPurchase } from "./purchase.js";
export interface CostPurchaseRepository { saveNew(purchase: CostPurchase): void; findById(purchaseId: PurchaseId): CostPurchase | undefined; saveWithExpectedVersion(purchase: CostPurchase, expectedVersion: number): void; }
