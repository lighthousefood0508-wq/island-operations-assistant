import type {
  MeasurementExactQuantityV1
} from "../contracts/measurement-foundation-contract.js";
import {
  InvalidMeasurementConversion,
  InvalidMeasurementQuantity,
  MeasurementNormalizationOverflow
} from "./errors.js";

const POSITIVE_CANONICAL_INTEGER_PATTERN = /^[1-9][0-9]*$/;
const MIN_SCALE = 0;
const MAX_SCALE = 6;
const MAX_INT64 = (2n ** 63n) - 1n;

export class ExactMeasurementQuantity {
  private constructor(
    readonly coefficient: bigint,
    readonly scale: number
  ) {
    Object.freeze(this);
  }

  static create(input: MeasurementExactQuantityV1): ExactMeasurementQuantity {
    if (!POSITIVE_CANONICAL_INTEGER_PATTERN.test(input.coefficient)) {
      throw new InvalidMeasurementQuantity(
        "Measurement coefficient must be a positive canonical integer string."
      );
    }
    if (!Number.isInteger(input.scale) || input.scale < MIN_SCALE || input.scale > MAX_SCALE) {
      throw new InvalidMeasurementQuantity(
        `Measurement scale must be an integer from ${MIN_SCALE} through ${MAX_SCALE}.`
      );
    }

    const coefficient = BigInt(input.coefficient);
    if (coefficient > MAX_INT64) {
      throw new InvalidMeasurementQuantity(
        "Measurement coefficient exceeds the signed 64-bit range."
      );
    }
    if (input.scale > 0 && coefficient % 10n === 0n) {
      throw new InvalidMeasurementQuantity(
        "Measurement quantity must use canonical scale without trailing zeroes."
      );
    }
    return new ExactMeasurementQuantity(coefficient, input.scale);
  }

  static fromExactArithmetic(
    coefficient: bigint,
    scale: number
  ): ExactMeasurementQuantity {
    if (coefficient <= 0n) {
      throw new InvalidMeasurementQuantity("Normalized measurement quantity must be positive.");
    }
    if (!Number.isInteger(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      throw new InvalidMeasurementConversion(
        `Normalized measurement scale must remain between ${MIN_SCALE} and ${MAX_SCALE}.`
      );
    }

    let canonicalCoefficient = coefficient;
    let canonicalScale = scale;
    while (canonicalScale > 0 && canonicalCoefficient % 10n === 0n) {
      canonicalCoefficient /= 10n;
      canonicalScale -= 1;
    }
    if (canonicalCoefficient > MAX_INT64) {
      throw new MeasurementNormalizationOverflow();
    }
    return new ExactMeasurementQuantity(canonicalCoefficient, canonicalScale);
  }

  toEvidence(): MeasurementExactQuantityV1 {
    return Object.freeze({
      coefficient: this.coefficient.toString(),
      scale: this.scale
    });
  }
}
