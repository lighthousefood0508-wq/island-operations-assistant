import { AmbiguousEffectiveIngredientCostQuote } from "./errors.js";
import { IngredientCostQuote } from "./ingredient-cost-quote.js";
import { IngredientCostQuoteId, IngredientId } from "./identities.js";

export type EffectiveIngredientCostQuoteLookup =
  | Readonly<{ status: "found"; quote: IngredientCostQuote }>
  | Readonly<{ status: "not_found" }>;

export function selectEffectiveIngredientCostQuote(
  quotes: readonly IngredientCostQuote[],
  ingredientId: IngredientId,
  instant: string
): EffectiveIngredientCostQuoteLookup {
  const authoritative = quotes.filter(
    (quote) => quote.ingredientId.equals(ingredientId) && quote.isAuthoritativeAt(instant)
  );
  if (authoritative.length === 0) {
    return Object.freeze({ status: "not_found" });
  }
  if (authoritative.length > 1) {
    throw new AmbiguousEffectiveIngredientCostQuote(
      authoritative.map((quote) => quote.quoteId.value)
    );
  }
  return Object.freeze({ status: "found", quote: authoritative[0]! });
}

export interface CostRepository {
  save(quote: IngredientCostQuote): void;
  saveWithExpectedVersion(quote: IngredientCostQuote, expectedVersion: number): number;
  findByQuoteId(quoteId: IngredientCostQuoteId): IngredientCostQuote | undefined;
  findQuotesByIngredientId(ingredientId: IngredientId): readonly IngredientCostQuote[];

  /**
   * Uses caller-provided time and the formal effective/supersession rules.
   * Implementations must throw AmbiguousEffectiveIngredientCostQuote rather than
   * choosing by insertion order, recordedAt, or identity.
   */
  findEffectiveQuoteAt(
    ingredientId: IngredientId,
    instant: string
  ): EffectiveIngredientCostQuoteLookup;
}
