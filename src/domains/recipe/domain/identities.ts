import { InvalidRecipeState } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

abstract class PrefixedIdentity {
  protected constructor(
    readonly value: string,
    prefix: string
  ) {
    const uuid = value.slice(prefix.length);
    if (!value.startsWith(prefix) || !UUID_PATTERN.test(uuid)) {
      throw new InvalidRecipeState(`Identity must use ${prefix}<uuid> format.`);
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

export class IngredientReferenceId extends PrefixedIdentity {
  private static readonly prefix = "ing_";

  private constructor(value: string) {
    super(value, IngredientReferenceId.prefix);
  }

  static parse(value: string): IngredientReferenceId {
    return new IngredientReferenceId(value);
  }

  static fromUuid(uuid: string): IngredientReferenceId {
    return new IngredientReferenceId(`${IngredientReferenceId.prefix}${uuid}`);
  }
}

export class RecipeId extends PrefixedIdentity {
  private static readonly prefix = "recipe_";

  private constructor(value: string) {
    super(value, RecipeId.prefix);
  }

  static parse(value: string): RecipeId {
    return new RecipeId(value);
  }

  static fromUuid(uuid: string): RecipeId {
    return new RecipeId(`${RecipeId.prefix}${uuid}`);
  }
}

export class RecipeDraftId extends PrefixedIdentity {
  private static readonly prefix = "recipe_draft_";

  private constructor(value: string) {
    super(value, RecipeDraftId.prefix);
  }

  static parse(value: string): RecipeDraftId {
    return new RecipeDraftId(value);
  }

  static fromUuid(uuid: string): RecipeDraftId {
    return new RecipeDraftId(`${RecipeDraftId.prefix}${uuid}`);
  }
}

export class RecipeVersionId extends PrefixedIdentity {
  private static readonly prefix = "recipe_version_";

  private constructor(value: string) {
    super(value, RecipeVersionId.prefix);
  }

  static parse(value: string): RecipeVersionId {
    return new RecipeVersionId(value);
  }

  static fromUuid(uuid: string): RecipeVersionId {
    return new RecipeVersionId(`${RecipeVersionId.prefix}${uuid}`);
  }
}
