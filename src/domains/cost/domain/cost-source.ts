import { InvalidCostSource } from "./errors.js";

export const COST_SOURCE_TYPES = [
  "supplier",
  "manual",
  "invoice",
  "receipt",
  "contract",
  "system"
] as const;

export type CostSourceType = (typeof COST_SOURCE_TYPES)[number];

export type CostSourceInput = Readonly<{
  sourceType: CostSourceType;
  sourceReferenceId?: string;
  supplierId?: string;
}>;

function optionalIdentity(value: string | undefined, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new InvalidCostSource(`${field} must not be blank.`);
  }
  return trimmed;
}

export class CostSource {
  private constructor(
    readonly sourceType: CostSourceType,
    readonly sourceReferenceId: string | undefined,
    readonly supplierId: string | undefined
  ) {
    Object.freeze(this);
  }

  static create(input: CostSourceInput): CostSource {
    if (!COST_SOURCE_TYPES.includes(input.sourceType)) {
      throw new InvalidCostSource(`Unsupported Cost Source type: ${String(input.sourceType)}.`);
    }
    return new CostSource(
      input.sourceType,
      optionalIdentity(input.sourceReferenceId, "Source reference identity"),
      optionalIdentity(input.supplierId, "Supplier identity")
    );
  }

  equals(other: CostSource): boolean {
    return this.sourceType === other.sourceType
      && this.sourceReferenceId === other.sourceReferenceId
      && this.supplierId === other.supplierId;
  }
}
