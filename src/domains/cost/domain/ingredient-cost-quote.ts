import { CostSource } from "./cost-source.js";
import { CostUnit } from "./cost-unit.js";
import { EffectivePeriod, assertIsoInstant } from "./effective-period.js";
import {
  IngredientCostQuoteAlreadySuperseded,
  IngredientCostQuoteVersionConflict,
  InvalidCostQuantity,
  InvalidIngredientCostQuote,
  InvalidIngredientCostQuoteSupersession
} from "./errors.js";
import { ExactDecimal } from "./exact-decimal.js";
import { IngredientCostQuoteId, IngredientId } from "./identities.js";
import { MonetaryAmount } from "./monetary-amount.js";

export type IngredientCostQuoteState = "Recorded" | "Superseded";

export type IngredientCostQuoteSupersession = Readonly<{
  supersededByQuoteId: IngredientCostQuoteId;
  supersededAt: string;
  supersededBy: string;
}>;

export type RecordIngredientCostQuoteInput = Readonly<{
  quoteId: IngredientCostQuoteId;
  ingredientId: IngredientId;
  monetaryAmount: MonetaryAmount;
  purchaseQuantity: ExactDecimal;
  purchaseUnit: CostUnit;
  effectivePeriod: EffectivePeriod;
  source: CostSource;
  recordedAt: string;
  recordedBy: string;
  aggregateVersion?: number;
}>;

export type SupersedeIngredientCostQuoteInput = Readonly<{
  supersededAt: string;
  supersededBy: string;
}>;

function actorIdentity(value: string, field: string): string {
  const canonical = value.trim();
  if (canonical.length === 0) {
    throw new InvalidIngredientCostQuote(`${field} must be a stable non-blank actor identity.`);
  }
  return canonical;
}

function aggregateVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidIngredientCostQuote("aggregateVersion must be a non-negative safe integer.");
  }
  return value;
}

export class IngredientCostQuote {
  readonly #quoteId: IngredientCostQuoteId;
  readonly #ingredientId: IngredientId;
  readonly #monetaryAmount: MonetaryAmount;
  readonly #purchaseQuantity: ExactDecimal;
  readonly #purchaseUnit: CostUnit;
  readonly #effectivePeriod: EffectivePeriod;
  readonly #source: CostSource;
  readonly #recordedAt: string;
  readonly #recordedBy: string;
  #aggregateVersion: number;
  #supersession: IngredientCostQuoteSupersession | undefined;

  private constructor(input: RecordIngredientCostQuoteInput) {
    this.#quoteId = input.quoteId;
    this.#ingredientId = input.ingredientId;
    this.#monetaryAmount = input.monetaryAmount;
    this.#purchaseQuantity = input.purchaseQuantity;
    this.#purchaseUnit = input.purchaseUnit;
    this.#effectivePeriod = input.effectivePeriod;
    this.#source = input.source;
    try {
      this.#recordedAt = assertIsoInstant(input.recordedAt, "recordedAt");
    } catch (error) {
      throw new InvalidIngredientCostQuote(error instanceof Error ? error.message : "recordedAt is invalid.");
    }
    this.#recordedBy = actorIdentity(input.recordedBy, "recordedBy");
    this.#aggregateVersion = aggregateVersion(input.aggregateVersion ?? 0);
  }

  static record(input: RecordIngredientCostQuoteInput): IngredientCostQuote {
    if (input.monetaryAmount.isNegative) {
      throw new InvalidIngredientCostQuote("Purchase amount must be greater than or equal to zero.");
    }
    if (!input.purchaseQuantity.isPositive) {
      throw new InvalidCostQuantity();
    }
    return new IngredientCostQuote(input);
  }

  get quoteId(): IngredientCostQuoteId {
    return this.#quoteId;
  }

  get ingredientId(): IngredientId {
    return this.#ingredientId;
  }

  get monetaryAmount(): MonetaryAmount {
    return this.#monetaryAmount;
  }

  get purchaseQuantity(): ExactDecimal {
    return this.#purchaseQuantity;
  }

  get purchaseUnit(): CostUnit {
    return this.#purchaseUnit;
  }

  get effectivePeriod(): EffectivePeriod {
    return this.#effectivePeriod;
  }

  get source(): CostSource {
    return this.#source;
  }

  get recordedAt(): string {
    return this.#recordedAt;
  }

  get recordedBy(): string {
    return this.#recordedBy;
  }

  get aggregateVersion(): number {
    return this.#aggregateVersion;
  }

  get state(): IngredientCostQuoteState {
    return this.#supersession === undefined ? "Recorded" : "Superseded";
  }

  get supersession(): IngredientCostQuoteSupersession | undefined {
    return this.#supersession;
  }

  assertExpectedVersion(expectedVersion: number): void {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || expectedVersion !== this.#aggregateVersion) {
      throw new IngredientCostQuoteVersionConflict(expectedVersion, this.#aggregateVersion);
    }
  }

  supersedeWith(
    supersedingQuote: IngredientCostQuote,
    input: SupersedeIngredientCostQuoteInput
  ): IngredientCostQuoteSupersession {
    if (this.#supersession !== undefined) {
      throw new IngredientCostQuoteAlreadySuperseded(this.#quoteId.value);
    }
    if (this.#quoteId.equals(supersedingQuote.quoteId)) {
      throw new InvalidIngredientCostQuoteSupersession("An Ingredient Cost Quote cannot supersede itself.");
    }
    if (!this.#ingredientId.equals(supersedingQuote.ingredientId)) {
      throw new InvalidIngredientCostQuoteSupersession(
        "A superseding Ingredient Cost Quote must reference the same Ingredient."
      );
    }

    let supersededAt: string;
    try {
      supersededAt = assertIsoInstant(input.supersededAt, "supersededAt");
    } catch (error) {
      throw new InvalidIngredientCostQuoteSupersession(
        error instanceof Error ? error.message : "supersededAt is invalid."
      );
    }
    const supersededBy = input.supersededBy.trim();
    if (supersededBy.length === 0) {
      throw new InvalidIngredientCostQuoteSupersession(
        "supersededBy must be a stable non-blank actor identity."
      );
    }

    this.#supersession = Object.freeze({
      supersededByQuoteId: supersedingQuote.quoteId,
      supersededAt,
      supersededBy
    });
    this.#aggregateVersion += 1;
    return this.#supersession;
  }

  isAuthoritativeAt(instant: string): boolean {
    if (!this.#effectivePeriod.contains(instant)) {
      return false;
    }
    return this.#supersession === undefined || instant < this.#supersession.supersededAt;
  }
}
