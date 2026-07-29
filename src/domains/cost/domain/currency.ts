import { InvalidCurrency } from "./errors.js";

export type CurrencyCode = string;

const ISO_STYLE_CURRENCY_CODE = /^[A-Z]{3}$/;

export class Currency {
  private constructor(readonly code: CurrencyCode) {
    Object.freeze(this);
  }

  static create(code: string): Currency {
    if (!ISO_STYLE_CURRENCY_CODE.test(code)) {
      throw new InvalidCurrency(code);
    }
    return new Currency(code);
  }

  static TWD(): Currency {
    return new Currency("TWD");
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}
