import assert from "node:assert/strict";
import test from "node:test";
import type {
  MeasurementProfileFactsResolutionRequestV1,
  MeasurementUnitResolutionContractV1,
  MeasurementUnitResolutionResultV1
} from "../domains/recipe/contracts/measurement-foundation-contract.js";
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
