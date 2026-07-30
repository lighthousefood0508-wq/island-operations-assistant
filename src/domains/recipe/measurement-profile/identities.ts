import type {
  CanonicalIngredientIdV1,
  IngredientMeasurementProfileId,
  IngredientMeasurementProfileIdentityV1,
  IngredientMeasurementProfileVersionId
} from "../contracts/ingredient-measurement-profile-contract.js";
import { InvalidIngredientMeasurementProfileIdentity } from "./errors.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertIdentity(value: string, prefix: string): void {
  const uuid = value.slice(prefix.length);
  if (!value.startsWith(prefix) || !UUID_PATTERN.test(uuid)) {
    throw new InvalidIngredientMeasurementProfileIdentity(prefix);
  }
}

export function createIngredientMeasurementProfileIdentity(input: {
  profileId: IngredientMeasurementProfileId;
  profileVersionId: IngredientMeasurementProfileVersionId;
  ingredientId: CanonicalIngredientIdV1;
}): IngredientMeasurementProfileIdentityV1 {
  assertIdentity(input.profileId, "measurement_profile_");
  assertIdentity(input.profileVersionId, "measurement_profile_version_");
  assertIdentity(input.ingredientId, "ing_");
  return Object.freeze({
    profileId: input.profileId,
    profileVersionId: input.profileVersionId,
    ingredientId: input.ingredientId
  });
}
