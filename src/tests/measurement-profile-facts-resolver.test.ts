import assert from "node:assert/strict";
import test from "node:test";
import type {
  MeasurementProfileFactsResolutionRequestV1,
  ResolvedMeasurementProfileFactsV1,
  MeasurementUnitResolutionContractV1,
  MeasurementUnitResolutionResultV1
} from "../domains/recipe/contracts/measurement-foundation-contract.js";
import type {
  CompleteMeasurementProfileFactsV1
} from "../domains/recipe/contracts/ingredient-measurement-profile-contract.js";
import { MeasurementProfileFactsResolver } from "../domains/recipe/measurement/measurement-profile-facts-resolver.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

function request(input: Partial<MeasurementProfileFactsResolutionRequestV1> = {}): MeasurementProfileFactsResolutionRequestV1 {
  return {
    rawDimension: input.rawDimension ?? "mass",
    rawCanonicalUnit: input.rawCanonicalUnit ?? "g",
    rawAllowedUnitValues: input.rawAllowedUnitValues ?? ["g", "kg", "tw_catty"]
  };
}

function assertResolved(
  result: ReturnType<MeasurementProfileFactsResolver["resolveProfileFacts"]>
): asserts result is Extract<typeof result, { status: "resolved" }> {
  assert.equal(result.status, "resolved");
}

const resolver = new MeasurementProfileFactsResolver(new MeasurementUnitResolver());

test("Measurement Profile Facts resolver returns typed mass facts in request order", () => {
  const result = resolver.resolveProfileFacts(request());
  assertResolved(result);
  assert.deepEqual(result.facts, {
    dimension: "mass",
    canonicalUnitCode: "g",
    allowedUnitCodes: ["g", "kg", "tw_catty"]
  });
  assert.equal(Object.isFrozen(result.facts), true);
  assert.equal(Object.isFrozen(result.facts.allowedUnitCodes), true);

  const canonical: "g" | "ml" | "each" = result.facts.canonicalUnitCode;
  const profileCanonical:
    CompleteMeasurementProfileFactsV1["canonicalUnitCode"] = canonical;
  assert.equal(profileCanonical, "g");
});

test("Measurement Profile Facts resolved canonical output excludes non-canonical stable units", () => {
  type ResolvedCanonical = ResolvedMeasurementProfileFactsV1["canonicalUnitCode"];

  // @ts-expect-error `kg` is stable but never a canonical Measurement code.
  const kilogram: ResolvedCanonical = "kg";
  // @ts-expect-error `l` is stable but never a canonical Measurement code.
  const litre: ResolvedCanonical = "l";
  void kilogram;
  void litre;
});

test("Measurement Profile Facts resolver supports volume and count", () => {
  for (const input of [
    request({ rawDimension: "volume", rawCanonicalUnit: "ml", rawAllowedUnitValues: ["ml", "l", "cc"] }),
    request({ rawDimension: "count", rawCanonicalUnit: "each", rawAllowedUnitValues: ["each", "dozen"] })
  ]) {
    const result = resolver.resolveProfileFacts(input);
    assertResolved(result);
    assert.equal(result.facts.canonicalUnitCode, input.rawCanonicalUnit);
  }
});

test("Measurement Profile Facts resolver preserves canonical output with non-canonical allowed units", () => {
  for (const [rawDimension, rawCanonicalUnit, expectedCanonical] of [
    ["mass", "g", "g"],
    ["volume", "ml", "ml"],
    ["count", "each", "each"]
  ] as const) {
    const result = resolver.resolveProfileFacts(request({
      rawDimension,
      rawCanonicalUnit,
      rawAllowedUnitValues: rawDimension === "mass"
        ? [rawCanonicalUnit, "kg"]
        : rawDimension === "volume"
          ? [rawCanonicalUnit, "l"]
          : [rawCanonicalUnit, "dozen"]
    }));
    assertResolved(result);
    assert.equal(result.facts.canonicalUnitCode, expectedCanonical);
  }
});

test("formal unit resolution retains non-canonical raw unit mappings", () => {
  const unitResolver = new MeasurementUnitResolver();
  for (const [rawValue, expectedUnitCode, expectedCanonical] of [
    ["kg", "kg", "g"],
    ["l", "l", "ml"],
    ["dozen", "dozen", "each"]
  ] as const) {
    const result = unitResolver.resolveUnit({ rawValue });
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.unitCode, expectedUnitCode);
      assert.equal(result.canonicalUnitCode, expectedCanonical);
    }
  }
});

test("Measurement Profile Facts resolver returns stable failures for raw or incompatible facts", () => {
  const cases: readonly [MeasurementProfileFactsResolutionRequestV1, string][] = [
    [request({ rawDimension: "temperature" }), "UNSUPPORTED_MEASUREMENT_DIMENSION"],
    [request({ rawCanonicalUnit: "stone" }), "UNRESOLVED_CANONICAL_MEASUREMENT_UNIT"],
    [request({ rawAllowedUnitValues: ["g", "stone"] }), "UNRESOLVED_ALLOWED_MEASUREMENT_UNIT"],
    [request({ rawDimension: "volume", rawCanonicalUnit: "g", rawAllowedUnitValues: ["g"] }), "CANONICAL_MEASUREMENT_UNIT_DIMENSION_MISMATCH"],
    [request({ rawAllowedUnitValues: ["g", "ml"] }), "ALLOWED_MEASUREMENT_UNIT_DIMENSION_MISMATCH"],
    [request({ rawAllowedUnitValues: ["g", "g"] }), "DUPLICATE_ALLOWED_MEASUREMENT_UNIT"],
    [request({ rawAllowedUnitValues: ["kg"] }), "INCOMPATIBLE_MEASUREMENT_PROFILE_FACTS"]
  ];
  for (const [input, code] of cases) {
    const result = resolver.resolveProfileFacts(input);
    assert.deepEqual(result, { status: "failed", code });
  }
});

test("Measurement Profile Facts resolver delegates every raw unit lookup to the formal resolver", () => {
  const calls: string[] = [];
  const formalUnitResolver: MeasurementUnitResolutionContractV1 = {
    resolveUnit(input): MeasurementUnitResolutionResultV1 {
      calls.push(input.rawValue);
      if (input.rawValue === "g") return Object.freeze({
        status: "resolved", scope: "EXPLICIT", rawValue: "g", unitCode: "g", dimension: "mass", canonicalUnitCode: "g"
      });
      if (input.rawValue === "kg") return Object.freeze({
        status: "resolved", scope: "EXPLICIT", rawValue: "kg", unitCode: "kg", dimension: "mass", canonicalUnitCode: "g"
      });
      return Object.freeze({ status: "unknown", rawValue: input.rawValue });
    }
  };
  const result = new MeasurementProfileFactsResolver(formalUnitResolver).resolveProfileFacts(
    request({ rawAllowedUnitValues: ["g", "kg"] })
  );
  assertResolved(result);
  assert.deepEqual(calls, ["g", "g", "kg"]);
});
