type CostSupplierErrorCode =
  | "COST_SUPPLIER_VALIDATION_FAILURE"
  | "COST_SUPPLIER_PERSISTENCE_FAILURE";

abstract class CostSupplierError extends Error {
  abstract readonly code: CostSupplierErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CostSupplierValidationFailure extends CostSupplierError {
  readonly code = "COST_SUPPLIER_VALIDATION_FAILURE" as const;

  constructor() {
    super("Cost Supplier command validation failed.");
  }
}

export class CostSupplierPersistenceFailure extends CostSupplierError {
  readonly code = "COST_SUPPLIER_PERSISTENCE_FAILURE" as const;

  constructor() {
    super("Cost Supplier persistence operation failed.");
  }
}
