import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
  type MeasurementDimensionV1,
  type MeasurementNormalizationRequestV1
} from "../domains/recipe/contracts/measurement-foundation-contract.js";
import {
  InvalidMeasurementConversion,
  InvalidMeasurementQuantity,
  MeasurementDimensionMismatch,
  MeasurementNormalizationOverflow,
  UnknownMeasurementUnit,
  UnsupportedMeasurementContractVersion
} from "../domains/recipe/measurement/errors.js";
import {
  MeasurementConversionRatio
} from "../domains/recipe/measurement/measurement-conversion-ratio.js";
import { MeasurementNormalizer } from "../domains/recipe/measurement/measurement-normalizer.js";

const normalizer = new MeasurementNormalizer();
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const sourceRoot = path.join(projectRoot, "src", "domains", "recipe");

function request(input: {
  coefficient?: string;
  scale?: number;
  unitCode?: string;
  dimension?: MeasurementDimensionV1;
} = {}): MeasurementNormalizationRequestV1 {
  return {
    contractVersion: MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
    dimension: input.dimension ?? "mass",
    rawQuantity: {
      coefficient: input.coefficient ?? "1",
      scale: input.scale ?? 0
    },
    rawUnitCode: input.unitCode ?? "g"
  };
}

function assertConversion(input: {
  unitCode: string;
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: "g" | "ml" | "each";
  numerator: string;
  denominator: string;
  conversionId: string;
}): void {
  const evidence = normalizer.normalize(request({
    unitCode: input.unitCode,
    dimension: input.dimension
  }));
  assert.equal(evidence.canonicalUnitCode, input.canonicalUnitCode);
  assert.deepEqual(evidence.conversionRatio, {
    numerator: input.numerator,
    denominator: input.denominator
  });
  assert.equal(evidence.conversionId, input.conversionId);
  assert.equal(evidence.conversionVersion, 1);
}

test("contract version 1 is accepted", () => {
  assert.equal(normalizer.normalize(request()).contractVersion, 1);
});

test("unsupported contract version is rejected", () => {
  const unsupported = { ...request(), contractVersion: 2 };
  assert.throws(
    () => normalizer.normalize(unsupported as unknown as MeasurementNormalizationRequestV1),
    UnsupportedMeasurementContractVersion
  );
});

test("g normalizes to g using 1/1", () => {
  assertConversion({
    unitCode: "g",
    dimension: "mass",
    canonicalUnitCode: "g",
    numerator: "1",
    denominator: "1",
    conversionId: "measurement.mass.g-to-g"
  });
});

test("kg normalizes to g using 1000/1", () => {
  assertConversion({
    unitCode: "kg",
    dimension: "mass",
    canonicalUnitCode: "g",
    numerator: "1000",
    denominator: "1",
    conversionId: "measurement.mass.kg-to-g"
  });
});

test("tw_catty normalizes to g using 600/1", () => {
  assertConversion({
    unitCode: "tw_catty",
    dimension: "mass",
    canonicalUnitCode: "g",
    numerator: "600",
    denominator: "1",
    conversionId: "measurement.mass.tw-catty-to-g"
  });
});

test("ml normalizes to ml using 1/1", () => {
  assertConversion({
    unitCode: "ml",
    dimension: "volume",
    canonicalUnitCode: "ml",
    numerator: "1",
    denominator: "1",
    conversionId: "measurement.volume.ml-to-ml"
  });
});

test("l normalizes to ml using 1000/1", () => {
  assertConversion({
    unitCode: "l",
    dimension: "volume",
    canonicalUnitCode: "ml",
    numerator: "1000",
    denominator: "1",
    conversionId: "measurement.volume.l-to-ml"
  });
});

test("cc normalizes to ml using 1/1", () => {
  assertConversion({
    unitCode: "cc",
    dimension: "volume",
    canonicalUnitCode: "ml",
    numerator: "1",
    denominator: "1",
    conversionId: "measurement.volume.cc-to-ml"
  });
});

test("each normalizes to each using 1/1", () => {
  assertConversion({
    unitCode: "each",
    dimension: "count",
    canonicalUnitCode: "each",
    numerator: "1",
    denominator: "1",
    conversionId: "measurement.count.each-to-each"
  });
});

test("dozen normalizes to each using 12/1", () => {
  assertConversion({
    unitCode: "dozen",
    dimension: "count",
    canonicalUnitCode: "each",
    numerator: "12",
    denominator: "1",
    conversionId: "measurement.count.dozen-to-each"
  });
});

test("5 tw_catty equals exactly 3000 g", () => {
  const evidence = normalizer.normalize(request({
    coefficient: "5",
    unitCode: "tw_catty"
  }));
  assert.deepEqual(evidence.normalizedQuantity, { coefficient: "3000", scale: 0 });
});

test("1.5 kg equals exactly 1500 g", () => {
  const evidence = normalizer.normalize(request({
    coefficient: "15",
    scale: 1,
    unitCode: "kg"
  }));
  assert.deepEqual(evidence.normalizedQuantity, { coefficient: "1500", scale: 0 });
});

test("conversion ratios are reduced by greatest common divisor", () => {
  assert.deepEqual(
    MeasurementConversionRatio.create("2", "4").toEvidence(),
    { numerator: "1", denominator: "2" }
  );
});

test("conversion ratios reject zero and noncanonical denominator evidence", () => {
  for (const denominator of ["0", "-1", "01"]) {
    assert.throws(
      () => MeasurementConversionRatio.create("1", denominator),
      InvalidMeasurementConversion
    );
  }
});

test("raw quantity and raw unit are preserved", () => {
  const evidence = normalizer.normalize(request({
    coefficient: "125",
    scale: 2,
    unitCode: "kg"
  }));
  assert.deepEqual(evidence.rawQuantity, { coefficient: "125", scale: 2 });
  assert.equal(evidence.rawUnitCode, "kg");
});

test("conversion identity and version are preserved", () => {
  const evidence = normalizer.normalize(request({ unitCode: "kg" }));
  assert.equal(evidence.conversionId, "measurement.mass.kg-to-g");
  assert.equal(evidence.conversionVersion, 1);
});

test("conversion numerator and denominator are preserved", () => {
  const evidence = normalizer.normalize(request({ unitCode: "tw_catty" }));
  assert.deepEqual(evidence.conversionRatio, {
    numerator: "600",
    denominator: "1"
  });
});

test("normalized quantity and canonical unit are preserved", () => {
  const evidence = normalizer.normalize(request({
    coefficient: "2",
    unitCode: "dozen",
    dimension: "count"
  }));
  assert.deepEqual(evidence.normalizedQuantity, { coefficient: "24", scale: 0 });
  assert.equal(evidence.canonicalUnitCode, "each");
});

test("unknown unit is rejected", () => {
  assert.throws(
    () => normalizer.normalize(request({ unitCode: "stone" })),
    UnknownMeasurementUnit
  );
});

test("unit and declared dimension mismatch is rejected", () => {
  assert.throws(
    () => normalizer.normalize(request({ unitCode: "kg", dimension: "volume" })),
    MeasurementDimensionMismatch
  );
});

test("ml to g has no legal path", () => {
  assert.throws(
    () => normalizer.normalize(request({ unitCode: "ml", dimension: "mass" })),
    MeasurementDimensionMismatch
  );
});

test("non-canonical coefficient is rejected", () => {
  for (const coefficient of ["01", "+1", "1.0", "1e3"]) {
    assert.throws(
      () => normalizer.normalize(request({ coefficient })),
      InvalidMeasurementQuantity
    );
  }
});

test("scale outside 0 through 6 is rejected", () => {
  for (const scale of [-1, 7, 1.5]) {
    assert.throws(
      () => normalizer.normalize(request({ scale })),
      InvalidMeasurementQuantity
    );
  }
});

test("normalization overflow is rejected", () => {
  assert.throws(
    () => normalizer.normalize(request({
      coefficient: "9223372036854775807",
      unitCode: "kg"
    })),
    MeasurementNormalizationOverflow
  );
});

test("evidence and nested values are deeply immutable", () => {
  const evidence = normalizer.normalize(request({ unitCode: "kg" }));
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.rawQuantity), true);
  assert.equal(Object.isFrozen(evidence.conversionRatio), true);
  assert.equal(Object.isFrozen(evidence.normalizedQuantity), true);
  assert.throws(() => {
    (evidence as unknown as { dimension: string }).dimension = "volume";
  }, TypeError);
  assert.throws(() => {
    (evidence.rawQuantity as unknown as { coefficient: string }).coefficient = "99";
  }, TypeError);
});

test("zero raw quantity is rejected", () => {
  assert.throws(
    () => normalizer.normalize(request({ coefficient: "0" })),
    InvalidMeasurementQuantity
  );
});

test("negative raw quantity is rejected", () => {
  assert.throws(
    () => normalizer.normalize(request({ coefficient: "-1" })),
    InvalidMeasurementQuantity
  );
});

test("uppercase L is rejected as a stable wire code", () => {
  assert.throws(
    () => normalizer.normalize(request({ unitCode: "L", dimension: "volume" })),
    UnknownMeasurementUnit
  );
});

test("public request contract exposes no consumer-selected target unit", () => {
  const contractSource = readFileSync(
    path.join(sourceRoot, "contracts", "measurement-foundation-contract.ts"),
    "utf8"
  );
  assert.doesNotMatch(contractSource, /targetUnit/i);
  assert.equal(Object.hasOwn(request(), "targetUnitCode"), false);
});

test("Measurement source contains no float arithmetic or Cost dependency", () => {
  const measurementDirectory = path.join(sourceRoot, "measurement");
  const source = readdirSync(measurementDirectory)
    .filter((filename) => filename.endsWith(".ts"))
    .map((filename) => readFileSync(path.join(measurementDirectory, filename), "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /parseFloat|parseInt|\.toFixed|\bNumber\s*\(|\bMath\./);
  assert.doesNotMatch(source, /domains[\\/]cost|cost[\\/]domain|ExactRatio/);
});

test("Measurement source contains no Database, API, UI, Runtime, or persistence dependency", () => {
  const measurementDirectory = path.join(sourceRoot, "measurement");
  const source = readdirSync(measurementDirectory)
    .filter((filename) => filename.endsWith(".ts"))
    .map((filename) => readFileSync(path.join(measurementDirectory, filename), "utf8"))
    .join("\n");
  assert.doesNotMatch(
    source,
    /better-sqlite3|node:sqlite|[\\/]database[\\/]|[\\/]persistence[\\/]|[\\/]api[\\/]|[\\/]web[\\/]|[\\/]server[\\/]/
  );
});
