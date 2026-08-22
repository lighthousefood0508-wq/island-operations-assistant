import { InvalidCostSupplier } from "./errors.js";
import { SupplierId } from "./identities.js";

export type CostSupplierContractV1 = Readonly<{
  supplierId: string;
  displayName: string;
  createdAt: string;
  createdBy: string;
  aggregateVersion: number;
}>;

export type CreateCostSupplierInput = Readonly<{
  supplierId: SupplierId;
  displayName: string;
  createdAt: string;
  createdBy: string;
  aggregateVersion?: number;
}>;

function text(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidCostSupplier(`${field} must be non-blank.`);
  }
  return value.trim();
}

function instant(value: string): string {
  const canonical = text(value, "createdAt");
  const milliseconds = Date.parse(canonical);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== canonical) {
    throw new InvalidCostSupplier("createdAt must be a canonical ISO-8601 UTC instant.");
  }
  return canonical;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value !== 0) {
    throw new InvalidCostSupplier("Supplier aggregateVersion must be zero in v1.");
  }
  return value;
}

export class CostSupplier {
  readonly #supplierId: SupplierId;
  readonly #displayName: string;
  readonly #createdAt: string;
  readonly #createdBy: string;
  readonly #aggregateVersion: number;

  private constructor(input: CreateCostSupplierInput) {
    this.#supplierId = input.supplierId;
    this.#displayName = text(input.displayName, "displayName");
    this.#createdAt = instant(input.createdAt);
    this.#createdBy = text(input.createdBy, "createdBy");
    this.#aggregateVersion = version(input.aggregateVersion ?? 0);
    Object.freeze(this);
  }

  static create(input: CreateCostSupplierInput): CostSupplier {
    return new CostSupplier(input);
  }

  static rehydrate(input: CreateCostSupplierInput): CostSupplier {
    return new CostSupplier(input);
  }

  get supplierId(): SupplierId { return this.#supplierId; }
  get displayName(): string { return this.#displayName; }
  get createdAt(): string { return this.#createdAt; }
  get createdBy(): string { return this.#createdBy; }
  get aggregateVersion(): number { return this.#aggregateVersion; }

  toContract(): CostSupplierContractV1 {
    return Object.freeze({
      supplierId: this.#supplierId.value,
      displayName: this.#displayName,
      createdAt: this.#createdAt,
      createdBy: this.#createdBy,
      aggregateVersion: this.#aggregateVersion
    });
  }
}
