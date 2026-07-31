import type {
  IngredientMeasurementProfileContractV1,
  IngredientMeasurementProfileId
} from "../contracts/ingredient-measurement-profile-contract.js";
import type { IngredientMeasurementProfile } from "./ingredient-measurement-profile.js";

export type VersionedIngredientMeasurementProfile =
  Readonly<{
    profile: IngredientMeasurementProfile;
    aggregateVersion: number;
  }>;

export interface IngredientMeasurementProfileStore {
  saveNew(profile: IngredientMeasurementProfile): void;
  saveWithExpectedVersion(
    profile: IngredientMeasurementProfile,
    expectedVersion: number
  ): number;
  findAggregateByProfileId(
    profileId: IngredientMeasurementProfileId
  ): VersionedIngredientMeasurementProfile | undefined;
  listProfiles(): readonly IngredientMeasurementProfileContractV1[];
}
