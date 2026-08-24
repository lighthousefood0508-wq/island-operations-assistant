import type { CostEvidenceReadPort } from "../domain/cost-evidence-read-port.js";
import {
  AcceptedPurchaseId,
  CostSnapshotId,
  PurchaseId,
  SupplierId
} from "../domain/identities.js";
import {
  CostEvidenceReadNotFound,
  CostEvidenceReadPersistenceFailure,
  CostEvidenceReadValidationFailure
} from "./cost-evidence-read-errors.js";

function identity<T>(value: string, parse: (value: string) => T): T {
  try {
    return parse(value);
  } catch {
    throw new CostEvidenceReadValidationFailure();
  }
}

/** Coordinates Cost-owned read contracts without acquiring any evidence authority. */
export class CostEvidenceReadService {
  constructor(private readonly reads: CostEvidenceReadPort) {}

  listSuppliers() {
    return this.read(() => this.reads.listSuppliers());
  }

  getSupplier(supplierId: string) {
    identity(supplierId, SupplierId.parse);
    return this.required(() => this.reads.findSupplier(supplierId));
  }

  getPurchase(purchaseId: string) {
    identity(purchaseId, PurchaseId.parse);
    return this.required(() => this.reads.findPurchase(purchaseId));
  }

  listAcceptedPurchasesForPurchase(purchaseId: string) {
    const parsed = identity(purchaseId, PurchaseId.parse);
    this.required(() => this.reads.findPurchase(purchaseId));
    return this.read(() => this.reads.listAcceptedPurchasesForPurchase(parsed));
  }

  getAcceptedPurchase(acceptedPurchaseId: string) {
    identity(acceptedPurchaseId, AcceptedPurchaseId.parse);
    return this.required(() => this.reads.findAcceptedPurchase(acceptedPurchaseId));
  }

  listSnapshotsForRecipe(recipeId: string) {
    if (typeof recipeId !== "string" || recipeId.trim().length === 0) {
      throw new CostEvidenceReadValidationFailure();
    }
    return this.read(() => this.reads.listSnapshotsForRecipe(recipeId));
  }

  getSnapshot(costSnapshotId: string) {
    identity(costSnapshotId, CostSnapshotId.parse);
    return this.required(() => this.reads.findSnapshot(costSnapshotId));
  }

  private required<T>(read: () => T | undefined): T {
    const result = this.read(read);
    if (result === undefined) throw new CostEvidenceReadNotFound();
    return result;
  }

  private read<T>(read: () => T): T {
    try {
      return read();
    } catch (error) {
      if (
        error instanceof CostEvidenceReadValidationFailure
        || error instanceof CostEvidenceReadNotFound
      ) {
        throw error;
      }
      throw new CostEvidenceReadPersistenceFailure();
    }
  }
}
