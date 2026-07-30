export abstract class MeasurementFoundationError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnsupportedMeasurementContractVersion extends MeasurementFoundationError {
  readonly code = "UNSUPPORTED_MEASUREMENT_CONTRACT_VERSION";

  constructor(version: unknown) {
    super(`Measurement Foundation contract version ${String(version)} is not supported.`);
  }
}

export class InvalidMeasurementQuantity extends MeasurementFoundationError {
  readonly code = "INVALID_MEASUREMENT_QUANTITY";

  constructor(message: string) {
    super(message);
  }
}

export class UnknownMeasurementUnit extends MeasurementFoundationError {
  readonly code = "UNKNOWN_MEASUREMENT_UNIT";

  constructor(unitCode: unknown) {
    super(`Measurement unit ${String(unitCode)} is not supported.`);
  }
}

export class MeasurementDimensionMismatch extends MeasurementFoundationError {
  readonly code = "MEASUREMENT_DIMENSION_MISMATCH";

  constructor(unitCode: string, declaredDimension: unknown, actualDimension: string) {
    super(
      `Measurement unit ${unitCode} belongs to ${actualDimension}, not ${String(declaredDimension)}.`
    );
  }
}

export class InvalidMeasurementConversion extends MeasurementFoundationError {
  readonly code = "INVALID_MEASUREMENT_CONVERSION";

  constructor(message: string) {
    super(message);
  }
}

export class UnsupportedMeasurementScale extends MeasurementFoundationError {
  readonly code = "UNSUPPORTED_MEASUREMENT_SCALE";

  constructor(message: string) {
    super(message);
  }
}

export class NonExactMeasurementNormalization extends MeasurementFoundationError {
  readonly code = "NON_EXACT_MEASUREMENT_NORMALIZATION";

  constructor() {
    super("Conversion result cannot be represented as an exact decimal.");
  }
}

export class MeasurementNormalizationOverflow extends MeasurementFoundationError {
  readonly code = "MEASUREMENT_NORMALIZATION_OVERFLOW";

  constructor() {
    super("Normalized measurement quantity exceeds the signed 64-bit range.");
  }
}

export class InvalidMeasurementUnitResolution extends MeasurementFoundationError {
  readonly code = "INVALID_MEASUREMENT_UNIT_RESOLUTION";

  constructor(message: string) {
    super(message);
  }
}
