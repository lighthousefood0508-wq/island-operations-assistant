import type {
  CanonicalIngredientIdV1
} from "../contracts/canonical-ingredient-contract.js";
import { InvalidCanonicalIngredientIdentity } from "./errors.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class CanonicalIngredientId {
  private constructor(readonly value: CanonicalIngredientIdV1) {
    const uuid = value.slice("ing_".length);
    if (!value.startsWith("ing_") || !UUID_PATTERN.test(uuid)) {
      throw new InvalidCanonicalIngredientIdentity();
    }
    Object.freeze(this);
  }

  static parse(value: string): CanonicalIngredientId {
    return new CanonicalIngredientId(value);
  }

  static fromUuid(uuid: string): CanonicalIngredientId {
    return new CanonicalIngredientId(`ing_${uuid}`);
  }

  equals(other: CanonicalIngredientId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
