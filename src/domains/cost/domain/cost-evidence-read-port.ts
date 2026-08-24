import type {
  AcceptedPurchaseContractV1
} from "./accepted-purchase.js";
import type { CostSnapshotContractV1 } from "./cost-snapshot.js";
import type { PurchaseId } from "./identities.js";
import type { CostPurchaseContractV1 } from "./purchase.js";
import type { CostSupplierContractV1 } from "./supplier.js";

/**
 * Cost-owned, read-only evidence boundary. It deliberately returns existing
 * public evidence contracts rather than introducing a second evidence model.
 */
export interface CostEvidenceReadPort {
  findSupplier(supplierId: string): CostSupplierContractV1 | undefined;
  listSuppliers(): readonly CostSupplierContractV1[];
  findPurchase(purchaseId: string): CostPurchaseContractV1 | undefined;
  findAcceptedPurchase(
    acceptedPurchaseId: string
  ): AcceptedPurchaseContractV1 | undefined;
  listAcceptedPurchasesForPurchase(
    purchaseId: PurchaseId
  ): readonly AcceptedPurchaseContractV1[];
  findSnapshot(costSnapshotId: string): CostSnapshotContractV1 | undefined;
  listSnapshotsForRecipe(
    recipeId: string
  ): readonly CostSnapshotContractV1[];
}
