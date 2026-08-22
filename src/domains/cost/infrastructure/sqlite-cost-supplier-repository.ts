import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { CostSupplierRepository } from "../domain/supplier-repository.js";
import { SupplierId } from "../domain/identities.js";
import { CostSupplier } from "../domain/supplier.js";
import { CostPersistenceFailure, InvalidCostPersistenceState } from "../persistence/errors.js";
import type { CostSupplierRecord, CostSupplierRow } from "../persistence/supplier-records.js";

const SUPPLIER_COLUMNS = `
  supplier_id,
  display_name,
  created_at,
  created_by,
  aggregate_version
`;

function toRecord(supplier: CostSupplier): CostSupplierRecord {
  return Object.freeze({
    supplierId: supplier.supplierId.value,
    displayName: supplier.displayName,
    createdAt: supplier.createdAt,
    createdBy: supplier.createdBy,
    aggregateVersion: supplier.aggregateVersion
  });
}

function hydrate(row: CostSupplierRow): CostSupplier {
  return CostSupplier.rehydrate({
    supplierId: SupplierId.parse(row.supplier_id),
    displayName: row.display_name,
    createdAt: row.created_at,
    createdBy: row.created_by,
    aggregateVersion: row.aggregate_version
  });
}

export class SqliteCostSupplierRepository implements CostSupplierRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  saveNew(supplier: CostSupplier): void {
    if (supplier.aggregateVersion !== 0) {
      throw new InvalidCostPersistenceState("A new Cost Supplier must have aggregateVersion zero.");
    }
    const record = toRecord(supplier);
    try {
      this.database.execute(
        `INSERT INTO cost_suppliers (
          supplier_id, display_name, created_at, created_by, aggregate_version
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          record.supplierId,
          record.displayName,
          record.createdAt,
          record.createdBy,
          record.aggregateVersion
        ]
      );
    } catch (error) {
      throw new CostPersistenceFailure("save Cost Supplier", error);
    }
  }

  findById(supplierId: SupplierId): CostSupplier | undefined {
    try {
      const row = this.database.queryOne<CostSupplierRow>(
        `SELECT ${SUPPLIER_COLUMNS}
           FROM cost_suppliers
          WHERE supplier_id = ?`,
        [supplierId.value]
      );
      return row === undefined ? undefined : hydrate(row);
    } catch (error) {
      throw new CostPersistenceFailure("find Cost Supplier by identity", error);
    }
  }

  list(): readonly CostSupplier[] {
    try {
      const rows = this.database.queryMany<CostSupplierRow>(
        `SELECT ${SUPPLIER_COLUMNS}
           FROM cost_suppliers
          ORDER BY supplier_id ASC`
      );
      return Object.freeze(rows.map(hydrate));
    } catch (error) {
      throw new CostPersistenceFailure("list Cost Suppliers", error);
    }
  }
}
