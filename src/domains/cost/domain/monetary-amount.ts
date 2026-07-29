import { Currency } from "./currency.js";
import { CurrencyMismatch, InvalidMonetaryAmount } from "./errors.js";
import { ExactDecimal } from "./exact-decimal.js";

export class MonetaryAmount {
  private constructor(
    readonly amount: ExactDecimal,
    readonly currency: Currency
  ) {
    Object.freeze(this);
  }

  static create(coefficient: string, scale: number, currency: Currency): MonetaryAmount {
    try {
      return new MonetaryAmount(ExactDecimal.create(coefficient, scale), currency);
    } catch (error) {
      if (error instanceof InvalidMonetaryAmount) {
        throw error;
      }
      throw new InvalidMonetaryAmount(error instanceof Error ? error.message : "Invalid monetary amount.");
    }
  }

  get coefficient(): string {
    return this.amount.coefficient;
  }

  get scale(): number {
    return this.amount.scale;
  }

  get isNegative(): boolean {
    return this.amount.isNegative;
  }

  get isZero(): boolean {
    return this.amount.isZero;
  }

  equals(other: MonetaryAmount): boolean {
    return this.currency.equals(other.currency) && this.amount.equals(other.amount);
  }

  compareTo(other: MonetaryAmount): -1 | 0 | 1 {
    if (!this.currency.equals(other.currency)) {
      throw new CurrencyMismatch(this.currency.code, other.currency.code);
    }
    return this.amount.compareTo(other.amount);
  }
}
