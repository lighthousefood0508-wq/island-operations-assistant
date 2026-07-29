import { InvalidExactDecimal } from "./errors.js";

const COEFFICIENT_PATTERN = /^-?[0-9]+$/;
const MIN_SCALE = 0;
const MAX_SCALE = 6;
const MIN_INT64 = -(2n ** 63n);
const MAX_INT64 = (2n ** 63n) - 1n;

export class ExactDecimal {
  private constructor(
    readonly coefficient: string,
    readonly scale: number
  ) {
    Object.freeze(this);
  }

  static create(coefficient: string, scale: number): ExactDecimal {
    if (!COEFFICIENT_PATTERN.test(coefficient)) {
      throw new InvalidExactDecimal("Coefficient must be a base-10 integer string.");
    }
    if (!Number.isInteger(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      throw new InvalidExactDecimal(`Scale must be an integer from ${MIN_SCALE} through ${MAX_SCALE}.`);
    }

    let canonicalCoefficient = BigInt(coefficient);
    let canonicalScale = scale;
    while (canonicalScale > 0 && canonicalCoefficient !== 0n && canonicalCoefficient % 10n === 0n) {
      canonicalCoefficient /= 10n;
      canonicalScale -= 1;
    }
    if (canonicalCoefficient < MIN_INT64 || canonicalCoefficient > MAX_INT64) {
      throw new InvalidExactDecimal("Coefficient exceeds signed 64-bit range.");
    }

    return new ExactDecimal(
      canonicalCoefficient === 0n ? "0" : canonicalCoefficient.toString(),
      canonicalCoefficient === 0n ? 0 : canonicalScale
    );
  }

  get isZero(): boolean {
    return this.coefficient === "0";
  }

  get isNegative(): boolean {
    return this.coefficient.startsWith("-");
  }

  get isPositive(): boolean {
    return !this.isZero && !this.isNegative;
  }

  equals(other: ExactDecimal): boolean {
    return this.coefficient === other.coefficient && this.scale === other.scale;
  }

  compareTo(other: ExactDecimal): -1 | 0 | 1 {
    const commonScale = Math.max(this.scale, other.scale);
    const left = BigInt(this.coefficient) * (10n ** BigInt(commonScale - this.scale));
    const right = BigInt(other.coefficient) * (10n ** BigInt(commonScale - other.scale));
    return left < right ? -1 : left > right ? 1 : 0;
  }
}
