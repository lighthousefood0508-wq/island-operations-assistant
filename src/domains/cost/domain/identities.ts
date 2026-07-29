import {
  InvalidCostItemIdentity,
  InvalidIngredientCostQuoteIdentity,
  InvalidIngredientIdentity
} from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

abstract class PrefixedIdentity {
  protected constructor(
    readonly value: string,
    prefix: string,
    errorFactory: () => Error
  ) {
    const uuid = value.slice(prefix.length);
    if (!value.startsWith(prefix) || !UUID_PATTERN.test(uuid)) {
      throw errorFactory();
    }
    Object.freeze(this);
  }

  equals(other: PrefixedIdentity): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class CostItemId extends PrefixedIdentity {
  private static readonly prefix = "cost_item_";

  private constructor(value: string) {
    super(value, CostItemId.prefix, () => new InvalidCostItemIdentity());
  }

  static parse(value: string): CostItemId {
    return new CostItemId(value);
  }

  static fromUuid(uuid: string): CostItemId {
    return new CostItemId(`${CostItemId.prefix}${uuid}`);
  }
}

/**
 * A reference to the canonical Recipe-owned Ingredient identity.
 * This type carries no Ingredient master data and creates no second authority.
 */
export class IngredientId extends PrefixedIdentity {
  private static readonly prefix = "ing_";

  private constructor(value: string) {
    super(value, IngredientId.prefix, () => new InvalidIngredientIdentity());
  }

  static parse(value: string): IngredientId {
    return new IngredientId(value);
  }

  static fromUuid(uuid: string): IngredientId {
    return new IngredientId(`${IngredientId.prefix}${uuid}`);
  }
}

export class IngredientCostQuoteId extends PrefixedIdentity {
  private static readonly prefix = "cost_quote_";

  private constructor(value: string) {
    super(value, IngredientCostQuoteId.prefix, () => new InvalidIngredientCostQuoteIdentity());
  }

  static parse(value: string): IngredientCostQuoteId {
    return new IngredientCostQuoteId(value);
  }

  static fromUuid(uuid: string): IngredientCostQuoteId {
    return new IngredientCostQuoteId(`${IngredientCostQuoteId.prefix}${uuid}`);
  }
}

export class IngredientCostItem {
  readonly kind = "ingredient";

  private constructor(
    readonly costItemId: CostItemId,
    readonly ingredientId: IngredientId
  ) {
    Object.freeze(this);
  }

  static create(costItemId: CostItemId, ingredientId: IngredientId): IngredientCostItem {
    return new IngredientCostItem(costItemId, ingredientId);
  }

  equals(other: IngredientCostItem): boolean {
    return this.costItemId.equals(other.costItemId) && this.ingredientId.equals(other.ingredientId);
  }
}
