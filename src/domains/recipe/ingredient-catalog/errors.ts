export type CanonicalIngredientErrorCode =
  | "INVALID_CANONICAL_INGREDIENT_IDENTITY"
  | "INVALID_CANONICAL_INGREDIENT_NAME"
  | "INVALID_INGREDIENT_CATEGORY"
  | "INVALID_CANONICAL_INGREDIENT_AUDIT_EVIDENCE"
  | "INVALID_CANONICAL_INGREDIENT_TRANSITION"
  | "CANONICAL_INGREDIENT_NOT_FOUND"
  | "CANONICAL_INGREDIENT_VERSION_CONFLICT";

export abstract class CanonicalIngredientError extends Error {
  abstract readonly code: CanonicalIngredientErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCanonicalIngredientIdentity extends CanonicalIngredientError {
  readonly code = "INVALID_CANONICAL_INGREDIENT_IDENTITY" as const;

  constructor() {
    super("Canonical Ingredient identity must use ing_<uuid> format.");
  }
}

export class InvalidCanonicalIngredientName extends CanonicalIngredientError {
  readonly code = "INVALID_CANONICAL_INGREDIENT_NAME" as const;

  constructor(message = "Canonical Ingredient name must not be blank.") {
    super(message);
  }
}

export class InvalidIngredientCategory extends CanonicalIngredientError {
  readonly code = "INVALID_INGREDIENT_CATEGORY" as const;

  constructor(categoryCode: string) {
    super(`Ingredient category ${categoryCode} is not approved for v1 writes.`);
  }
}

export class InvalidCanonicalIngredientAuditEvidence
  extends CanonicalIngredientError {
  readonly code = "INVALID_CANONICAL_INGREDIENT_AUDIT_EVIDENCE" as const;

  constructor(field: string) {
    super(`Canonical Ingredient ${field} must be valid caller-provided evidence.`);
  }
}

export class InvalidCanonicalIngredientTransition
  extends CanonicalIngredientError {
  readonly code = "INVALID_CANONICAL_INGREDIENT_TRANSITION" as const;

  constructor(from: string, action: string) {
    super(`Canonical Ingredient cannot apply ${action} from ${from}.`);
  }
}

export class CanonicalIngredientNotFound extends CanonicalIngredientError {
  readonly code = "CANONICAL_INGREDIENT_NOT_FOUND" as const;

  constructor(ingredientId: string) {
    super(`Canonical Ingredient ${ingredientId} was not found.`);
  }
}

export class CanonicalIngredientVersionConflict extends CanonicalIngredientError {
  readonly code = "CANONICAL_INGREDIENT_VERSION_CONFLICT" as const;

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Canonical Ingredient expected version ${expectedVersion}, actual version ${actualVersion}.`
    );
  }
}
