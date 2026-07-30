import type {
  MeasurementConversionRatioEvidenceV1
} from "../contracts/measurement-foundation-contract.js";
import { ExactMeasurementQuantity } from "./exact-measurement-quantity.js";
import {
  InvalidMeasurementConversion,
  NonExactMeasurementNormalization,
  UnsupportedMeasurementScale
} from "./errors.js";

const POSITIVE_CANONICAL_INTEGER_PATTERN = /^[1-9][0-9]*$/;
const MAX_INT64 = (2n ** 63n) - 1n;
const MAX_SCALE = 6;

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function factorCount(value: bigint, factor: bigint): Readonly<{
  count: number;
  remainder: bigint;
}> {
  let count = 0;
  let remainder = value;
  while (remainder % factor === 0n) {
    remainder /= factor;
    count += 1;
  }
  return { count, remainder };
}

export class MeasurementConversionRatio {
  private constructor(
    readonly numerator: bigint,
    readonly denominator: bigint
  ) {
    Object.freeze(this);
  }

  static create(numerator: string, denominator: string): MeasurementConversionRatio {
    if (
      !POSITIVE_CANONICAL_INTEGER_PATTERN.test(numerator) ||
      !POSITIVE_CANONICAL_INTEGER_PATTERN.test(denominator)
    ) {
      throw new InvalidMeasurementConversion(
        "Conversion numerator and denominator must be positive canonical integer strings."
      );
    }

    const rawNumerator = BigInt(numerator);
    const rawDenominator = BigInt(denominator);
    if (rawNumerator > MAX_INT64 || rawDenominator > MAX_INT64) {
      throw new InvalidMeasurementConversion(
        "Conversion numerator and denominator must fit signed 64-bit integers."
      );
    }
    const divisor = greatestCommonDivisor(rawNumerator, rawDenominator);
    return new MeasurementConversionRatio(
      rawNumerator / divisor,
      rawDenominator / divisor
    );
  }

  apply(quantity: ExactMeasurementQuantity): ExactMeasurementQuantity {
    let numerator = quantity.coefficient * this.numerator;
    let denominator = (10n ** BigInt(quantity.scale)) * this.denominator;
    const divisor = greatestCommonDivisor(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;

    const powersOfTwo = factorCount(denominator, 2n);
    const powersOfFive = factorCount(powersOfTwo.remainder, 5n);
    if (powersOfFive.remainder !== 1n) {
      throw new NonExactMeasurementNormalization();
    }

    const scale =
      powersOfTwo.count > powersOfFive.count
        ? powersOfTwo.count
        : powersOfFive.count;
    if (scale > MAX_SCALE) {
      throw new UnsupportedMeasurementScale(
        `Conversion result exceeds the supported scale of ${MAX_SCALE}.`
      );
    }
    const coefficient =
      numerator *
      (2n ** BigInt(scale - powersOfTwo.count)) *
      (5n ** BigInt(scale - powersOfFive.count));
    return ExactMeasurementQuantity.fromExactArithmetic(coefficient, scale);
  }

  toEvidence(): MeasurementConversionRatioEvidenceV1 {
    return Object.freeze({
      numerator: this.numerator.toString(),
      denominator: this.denominator.toString()
    });
  }
}
