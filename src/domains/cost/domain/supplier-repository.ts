import type { SupplierId } from "./identities.js";
import type { CostSupplier } from "./supplier.js";

export interface CostSupplierRepository {
  saveNew(supplier: CostSupplier): void;
  findById(supplierId: SupplierId): CostSupplier | undefined;
  list(): readonly CostSupplier[];
}
