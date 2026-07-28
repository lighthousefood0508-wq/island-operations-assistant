import { InvalidRecipeState } from "./errors.js";

export type MeasurementDimension = "mass" | "volume" | "count";

const UNIT_CODE_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export class Unit {
  private constructor(
    readonly code: string,
    readonly dimension: MeasurementDimension
  ) {
    Object.freeze(this);
  }

  static create(code: string, dimension: MeasurementDimension): Unit {
    const canonicalCode = code.trim().toLowerCase();
    if (!UNIT_CODE_PATTERN.test(canonicalCode)) {
      throw new InvalidRecipeState("Unit code must be a canonical lowercase identifier.");
    }
    return new Unit(canonicalCode, dimension);
  }

  equals(other: Unit): boolean {
    return this.code === other.code && this.dimension === other.dimension;
  }
}
