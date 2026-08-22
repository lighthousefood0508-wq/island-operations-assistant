import { randomUUID } from "node:crypto";
import type { CostSupplierRepository } from "../domain/supplier-repository.js";
import { SupplierId } from "../domain/identities.js";
import { CostSupplier, type CostSupplierContractV1 } from "../domain/supplier.js";
import {
  CostSupplierPersistenceFailure,
  CostSupplierValidationFailure
} from "./cost-supplier-errors.js";

type SupplierRepository = Pick<CostSupplierRepository, "saveNew" | "list">;

export type CreateCostSupplierCommand = Readonly<{
  displayName: string;
  occurredAt: string;
  actor: string;
}>;

function text(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CostSupplierValidationFailure();
  }
  return value.trim();
}

function instant(value: string): string {
  const canonical = text(value);
  const milliseconds = Date.parse(canonical);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== canonical) {
    throw new CostSupplierValidationFailure();
  }
  return canonical;
}

export class CostSupplierService {
  constructor(private readonly repository: SupplierRepository) {}

  create(command: CreateCostSupplierCommand): CostSupplierContractV1 {
    let supplier: CostSupplier;
    try {
      supplier = CostSupplier.create({
        supplierId: SupplierId.fromUuid(randomUUID()),
        displayName: text(command.displayName),
        createdAt: instant(command.occurredAt),
        createdBy: text(command.actor)
      });
    } catch {
      throw new CostSupplierValidationFailure();
    }
    try {
      this.repository.saveNew(supplier);
    } catch {
      throw new CostSupplierPersistenceFailure();
    }
    return supplier.toContract();
  }

  list(): readonly CostSupplierContractV1[] {
    try {
      return Object.freeze(
        this.repository.list()
          .map((supplier) => supplier.toContract())
          .sort((left, right) => left.supplierId.localeCompare(right.supplierId))
      );
    } catch {
      throw new CostSupplierPersistenceFailure();
    }
  }
}
