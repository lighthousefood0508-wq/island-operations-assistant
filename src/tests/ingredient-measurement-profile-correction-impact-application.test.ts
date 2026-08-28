import assert from "node:assert/strict";
import test from "node:test";
import {
  IngredientMeasurementProfileCorrectionImpactNotFound,
  IngredientMeasurementProfileCorrectionImpactReadFailure,
  IngredientMeasurementProfileCorrectionImpactService
} from "../application/ingredient-measurement-profile-correction-impact-service.js";
import { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

const INGREDIENT_ID = "ing_123e4567-e89b-42d3-a456-426614174000";
const PROFILE_ID = "measurement_profile_123e4567-e89b-42d3-a456-426614174001";
const VERSION_ID = "measurement_profile_version_123e4567-e89b-42d3-a456-426614174002";
const AT = "2026-08-28T00:00:00.000Z";

function profile() {
  return IngredientMeasurementProfile.createDraft({
    identity: { profileId: PROFILE_ID, profileVersionId: VERSION_ID, ingredientId: INGREDIENT_ID },
    createdAt: AT,
    createdBy: "owner"
  }).activateDraft(VERSION_ID, {
    dimension: "mass",
    canonicalUnitCode: "g",
    allowedUnitCodes: ["g", "kg"],
    profileAliases: [],
    source: { sourceType: "MANUAL", recordedAt: AT, recordedBy: "owner" }
  }, { occurredAt: AT, actorId: "owner" }, new MeasurementUnitResolver());
}

function canonicalImpact(draftCount = 0) {
  return Object.freeze({
    contractName: "CanonicalIngredientReferenceImpact" as const,
    contractVersion: 1 as const,
    ingredientId: INGREDIENT_ID,
    recipeDrafts: Object.freeze({ availability: "Available" as const, uniqueRecipeCount: draftCount, draftCount, lineOccurrenceCount: draftCount, recipeIds: draftCount ? ["recipe_1"] : [], draftIds: draftCount ? ["draft_1"] : [], references: [] }),
    recipePublishedVersions: Object.freeze({ availability: "Available" as const, uniqueRecipeCount: 0, publishedVersionCount: 0, lineOccurrenceCount: 0, recipeIds: [], recipeVersionIds: [], references: [] }),
    costQuotes: Object.freeze({ availability: "Available" as const, quoteCount: 0, quoteIds: [] }),
    acceptedPurchases: Object.freeze({ availability: "Available" as const, acceptedPurchaseCount: 0, acceptedPurchaseIds: [] }),
    costSnapshots: Object.freeze({ availability: "Available" as const, costSnapshotCount: 0, costSnapshotIds: [] }),
    deletionEligibility: Object.freeze({ status: "Indeterminate" as const, blocked: true as const })
  });
}

function fixture(input: Readonly<{ draftCount?: number; purchaseIds?: readonly string[] }> = {}) {
  const stored = profile();
  return new IngredientMeasurementProfileCorrectionImpactService(
    { findAggregateByProfileId: () => Object.freeze({ profile: stored, aggregateVersion: 4 }) },
    { getByIngredientId: () => canonicalImpact(input.draftCount) },
    { findIngredientPurchaseReferences: () => Object.freeze({ contractName: "CostPurchaseReferenceImpact" as const, contractVersion: 1 as const, purchaseIds: Object.freeze([...(input.purchaseIds ?? [])]) }) }
  );
}

test("Correction Impact returns current facts, CAS version and permits unreferenced cross-basis correction", () => {
  const result = fixture().getByProfileId(PROFILE_ID);
  assert.equal(result.profileId, PROFILE_ID);
  assert.equal(result.ingredientId, INGREDIENT_ID);
  assert.equal(result.expectedVersion, 4);
  assert.deepEqual(result.activeVersion, {
    profileVersionId: VERSION_ID,
    dimension: "mass",
    canonicalUnitCode: "g",
    allowedUnitCodes: ["g", "kg"],
    state: "Active"
  });
  assert.equal(result.crossBasisCorrectionAllowed, true);
});

test("Correction Impact blocks cross-basis correction and identifies Recipe and Purchase references", () => {
  const result = fixture({ draftCount: 1, purchaseIds: ["pur_2", "pur_1", "pur_1"] }).getByProfileId(PROFILE_ID);
  assert.equal(result.crossBasisCorrectionAllowed, false);
  assert.equal(result.references.recipeDrafts.lineOccurrenceCount, 1);
  assert.deepEqual(result.references.purchases.purchaseIds, ["pur_1", "pur_2"]);
  assert.equal(result.references.purchases.purchaseCount, 2);
});

test("Correction Impact contains missing and technical failures", () => {
  const missing = new IngredientMeasurementProfileCorrectionImpactService(
    { findAggregateByProfileId: () => undefined },
    { getByIngredientId: () => canonicalImpact() },
    { findIngredientPurchaseReferences: () => Object.freeze({ contractName: "CostPurchaseReferenceImpact" as const, contractVersion: 1 as const, purchaseIds: [] }) }
  );
  assert.throws(() => missing.getByProfileId(PROFILE_ID), IngredientMeasurementProfileCorrectionImpactNotFound);

  const failing = new IngredientMeasurementProfileCorrectionImpactService(
    { findAggregateByProfileId: () => Object.freeze({ profile: profile(), aggregateVersion: 0 }) },
    { getByIngredientId: () => { throw new Error("SQLITE private stack"); } },
    { findIngredientPurchaseReferences: () => Object.freeze({ contractName: "CostPurchaseReferenceImpact" as const, contractVersion: 1 as const, purchaseIds: [] }) }
  );
  assert.throws(() => failing.getByProfileId(PROFILE_ID), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileCorrectionImpactReadFailure);
    assert.doesNotMatch(error.message, /sqlite|private|stack/i);
    return true;
  });
});
