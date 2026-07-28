import { InvalidRecipeState } from "./errors.js";
import { Unit } from "./unit.js";

const MIN_SCALE = 0;
const MAX_SCALE = 6;

export class Quantity {
  private constructor(
    readonly coefficient: bigint,
    readonly scale: number,
    readonly unit: Unit
  ) {
    Object.freeze(this);
  }

  static create(coefficient: bigint, scale: number, unit: Unit): Quantity {
    if (coefficient <= 0n) {
      throw new InvalidRecipeState("Quantity coefficient must be positive.");
    }
    if (!Number.isInteger(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      throw new InvalidRecipeState(`Quantity scale must be an integer from ${MIN_SCALE} through ${MAX_SCALE}.`);
    }
    if (scale > 0 && coefficient % 10n === 0n) {
      throw new InvalidRecipeState("Quantity must use canonical scale without trailing zeroes.");
    }
    return new Quantity(coefficient, scale, unit);
  }

  equals(other: Quantity): boolean {
    return this.coefficient === other.coefficient && this.scale === other.scale && this.unit.equals(other.unit);
  }
}
