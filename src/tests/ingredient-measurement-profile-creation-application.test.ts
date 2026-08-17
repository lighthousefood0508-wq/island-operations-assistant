import assert from "node:assert/strict";
import test from "node:test";
import {
  IngredientMeasurementProfileCreationIngredientInactive,
  IngredientMeasurementProfileCreationIngredientNotFound,
  IngredientMeasurementProfileCreationMeasurementFailure,
  IngredientMeasurementProfileCreationPersistenceFailure,
  IngredientMeasurementProfileCreationService,
  IngredientMeasurementProfileCreationValidationFailure
} from "../domains/recipe/index.js";
import type { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import type { MeasurementProfileFactsResolutionContractV1 } from "../domains/recipe/contracts/measurement-foundation-contract.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

class IngredientFixture {
  state: "Active" | "Archived" | undefined = "Active";

  findById() {
    return this.state === undefined ? undefined : Object.freeze({ status: this.state });
  }
}

class ProfileFixture {
  readonly saved: IngredientMeasurementProfile[] = [];
  failure: unknown = undefined;

  saveNew(profile: IngredientMeasurementProfile): void {
    if (this.failure !== undefined) throw this.failure;
    this.saved.push(profile);
  }
}

function command(overrides: Partial<{
  ingredientId: string;
  dimension: string;
  canonicalUnitCode: string;
  allowedUnitCodes: readonly string[];
  occurredAt: string;
  actor: string;
}> = {}) {
  return {
    ingredientId: "ing_123e4567-e89b-42d3-a456-426614174000",
    dimension: "mass",
    canonicalUnitCode: "g",
    allowedUnitCodes: ["g", "kg"],
    occurredAt: "2026-08-17T01:00:00.000Z",
    actor: "owner",
    ...overrides
  };
}

function service(
  ingredients = new IngredientFixture(),
  profiles = new ProfileFixture(),
  facts: MeasurementProfileFactsResolutionContractV1 = {
    resolveProfileFacts(input: { rawDimension: string; rawCanonicalUnit: string; rawAllowedUnitValues: readonly string[] }) {
      return Object.freeze({
        status: "resolved" as const,
        facts: Object.freeze({
          dimension: "mass" as const,
          canonicalUnitCode: "g" as const,
          allowedUnitCodes: Object.freeze(["g", "kg"] as const)
        })
      });
    }
  }
) {
  return {
    ingredients,
    profiles,
    facts,
    creation: new IngredientMeasurementProfileCreationService(
      ingredients,
      profiles,
      facts,
      new MeasurementUnitResolver()
    )
  };
}

test("Profile Creation Service creates one Active Profile through typed Measurement facts", () => {
  const fixture = service();
  const result = fixture.creation.create(command());

  assert.match(result.profileId, /^measurement_profile_[0-9a-f-]{36}$/);
  assert.equal(result.versions[0]?.state, "Active");
  assert.equal(result.versions[0]?.canonicalUnitCode, "g");
  assert.equal(fixture.profiles.saved.length, 1);
});

test("Profile Creation Service forwards raw Measurement values without local filtering", () => {
  const seen: unknown[] = [];
  const fixture = service(undefined, undefined, {
    resolveProfileFacts(input: { rawDimension: string; rawCanonicalUnit: string; rawAllowedUnitValues: readonly string[] }) {
      seen.push(input);
      return Object.freeze({
        status: "resolved" as const,
        facts: Object.freeze({
          dimension: "mass" as const,
          canonicalUnitCode: "g" as const,
          allowedUnitCodes: Object.freeze(["g", "kg"] as const)
        })
      });
    }
  });
  fixture.creation.create(command({
    dimension: "owner-controlled-dimension-token",
    canonicalUnitCode: "owner-controlled-canonical-token",
    allowedUnitCodes: ["owner-controlled-allowed-token"]
  }));
  assert.deepEqual(seen, [{
    rawDimension: "owner-controlled-dimension-token",
    rawCanonicalUnit: "owner-controlled-canonical-token",
    rawAllowedUnitValues: ["owner-controlled-allowed-token"]
  }]);
});

test("Profile Creation Service rejects missing, inactive, invalid and Measurement failures without writing", () => {
  const missing = service();
  missing.ingredients.state = undefined;
  assert.throws(() => missing.creation.create(command()), IngredientMeasurementProfileCreationIngredientNotFound);
  assert.equal(missing.profiles.saved.length, 0);

  const inactive = service();
  inactive.ingredients.state = "Archived";
  assert.throws(() => inactive.creation.create(command()), IngredientMeasurementProfileCreationIngredientInactive);
  assert.equal(inactive.profiles.saved.length, 0);

  const invalid = service();
  assert.throws(() => invalid.creation.create(command({ actor: "" })), IngredientMeasurementProfileCreationValidationFailure);
  assert.equal(invalid.profiles.saved.length, 0);

  const measurement = service(undefined, undefined, {
    resolveProfileFacts() {
      return Object.freeze({ status: "failed" as const, code: "UNSUPPORTED_MEASUREMENT_DIMENSION" as const });
    }
  });
  assert.throws(() => measurement.creation.create(command()), IngredientMeasurementProfileCreationMeasurementFailure);
  assert.equal(measurement.profiles.saved.length, 0);
});

test("Profile Creation Service contains persistence detail", () => {
  const fixture = service();
  fixture.profiles.failure = new Error("SQLITE private stack cause");
  assert.throws(() => fixture.creation.create(command()), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileCreationPersistenceFailure);
    assert.doesNotMatch(error.message, /sqlite|private|stack|cause/i);
    return true;
  });
});
