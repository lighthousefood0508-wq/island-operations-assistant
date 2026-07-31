import { CanonicalIngredient } from "./canonical-ingredient.js";
import { CanonicalIngredientId } from "./identities.js";

export interface CanonicalIngredientRepository {
  saveNew(ingredient: CanonicalIngredient): void;

  /**
   * The implementation must atomically reject a stale expectedVersion with
   * CanonicalIngredientVersionConflict. Silent overwrite is prohibited.
   */
  saveWithExpectedVersion(
    ingredient: CanonicalIngredient,
    expectedVersion: number
  ): number;

  findById(
    ingredientId: CanonicalIngredientId
  ): CanonicalIngredient | undefined;

  /**
   * Candidate-only queries. Implementations must not select, merge, or rewrite
   * an Ingredient identity and must not treat normalized name as uniqueness.
   */
  searchByName(query: string): readonly CanonicalIngredient[];
  findDuplicateCandidates(name: string): readonly CanonicalIngredient[];
}
