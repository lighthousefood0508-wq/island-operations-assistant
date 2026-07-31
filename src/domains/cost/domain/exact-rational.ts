const INTEGER_PATTERN = /^-?[0-9]+$/;
const MIN_SOURCE_COEFFICIENT = -(2n ** 63n);
const MAX_SOURCE_COEFFICIENT = (2n ** 63n) - 1n;

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function parseInteger(value: string, field: string): bigint {
  if (!INTEGER_PATTERN.test(value)) {
    throw new ExactRationalError(`${field} must be a base-10 integer string.`);
  }
  return BigInt(value);
}

export class ExactRationalError extends Error {
  readonly code = "INVALID_EXACT_RATIONAL";

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ExactRational {
  private constructor(
    readonly numerator: string,
    readonly denominator: string
  ) {
    Object.freeze(this);
  }

  static create(numerator: string, denominator: string): ExactRational {
    let canonicalNumerator = parseInteger(numerator, "numerator");
    let canonicalDenominator = parseInteger(denominator, "denominator");
    if (canonicalDenominator === 0n) {
      throw new ExactRationalError("denominator must not be zero.");
    }
    if (canonicalNumerator === 0n) {
      return new ExactRational("0", "1");
    }
    if (canonicalDenominator < 0n) {
      canonicalNumerator = -canonicalNumerator;
      canonicalDenominator = -canonicalDenominator;
    }
    const divisor = greatestCommonDivisor(
      canonicalNumerator,
      canonicalDenominator
    );
    return new ExactRational(
      (canonicalNumerator / divisor).toString(),
      (canonicalDenominator / divisor).toString()
    );
  }

  static fromExactDecimal(
    coefficient: string,
    scale: number
  ): ExactRational {
    if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
      throw new ExactRationalError(
        "Exact decimal scale must be an integer from 0 through 6."
      );
    }
    const sourceCoefficient = parseInteger(coefficient, "coefficient");
    if (
      sourceCoefficient < MIN_SOURCE_COEFFICIENT
      || sourceCoefficient > MAX_SOURCE_COEFFICIENT
    ) {
      throw new ExactRationalError(
        "Exact decimal coefficient exceeds signed 64-bit range."
      );
    }
    return ExactRational.create(
      sourceCoefficient.toString(),
      (10n ** BigInt(scale)).toString()
    );
  }

  get isZero(): boolean {
    return this.numerator === "0";
  }

  get isPositive(): boolean {
    return !this.isZero && !this.numerator.startsWith("-");
  }

  add(other: ExactRational): ExactRational {
    const leftNumerator = BigInt(this.numerator);
    const leftDenominator = BigInt(this.denominator);
    const rightNumerator = BigInt(other.numerator);
    const rightDenominator = BigInt(other.denominator);
    return ExactRational.create(
      (
        leftNumerator * rightDenominator
        + rightNumerator * leftDenominator
      ).toString(),
      (leftDenominator * rightDenominator).toString()
    );
  }

  multiply(other: ExactRational): ExactRational {
    return ExactRational.create(
      (BigInt(this.numerator) * BigInt(other.numerator)).toString(),
      (BigInt(this.denominator) * BigInt(other.denominator)).toString()
    );
  }

  divide(other: ExactRational): ExactRational {
    if (other.isZero) {
      throw new ExactRationalError("Cannot divide by zero.");
    }
    return ExactRational.create(
      (BigInt(this.numerator) * BigInt(other.denominator)).toString(),
      (BigInt(this.denominator) * BigInt(other.numerator)).toString()
    );
  }

  equals(other: ExactRational): boolean {
    return this.numerator === other.numerator
      && this.denominator === other.denominator;
  }
}
