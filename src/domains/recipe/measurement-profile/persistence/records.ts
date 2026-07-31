import type {
  IngredientMeasurementProfileStatus,
  IngredientMeasurementSourceType
} from "../../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementDimensionV1
} from "../../contracts/measurement-foundation-contract.js";

export type IngredientMeasurementProfileRecord = Readonly<{
  profileId: string;
  ingredientId: string;
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
}>;

export type IngredientMeasurementProfileVersionRecord = Readonly<{
  profileVersionId: string;
  profileId: string;
  ingredientId: string;
  versionPosition: number;
  state: IngredientMeasurementProfileStatus;
  dimension?: MeasurementDimensionV1;
  canonicalUnitCode?: "g" | "ml" | "each";
  allowedUnitCodesJson?: string;
  profileAliasesJson?: string;
  sourceType?: IngredientMeasurementSourceType;
  sourceReferenceId?: string;
  sourceRecordedAt?: string;
  sourceRecordedBy?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  supersedingProfileVersionId?: string;
  lifecycleJson: string;
}>;

export type IngredientMeasurementProfileRow = Readonly<{
  profile_id: string;
  ingredient_id: string;
  aggregate_version: number;
  created_at: string;
  created_by: string;
}>;

export type IngredientMeasurementProfileVersionRow = Readonly<{
  profile_version_id: string;
  profile_id: string;
  ingredient_id: string;
  version_position: number;
  state: IngredientMeasurementProfileStatus;
  dimension: MeasurementDimensionV1 | null;
  canonical_unit_code: "g" | "ml" | "each" | null;
  allowed_unit_codes_json: string | null;
  profile_aliases_json: string | null;
  source_type: IngredientMeasurementSourceType | null;
  source_reference_id: string | null;
  source_recorded_at: string | null;
  source_recorded_by: string | null;
  effective_from: string | null;
  effective_to: string | null;
  superseding_profile_version_id: string | null;
  lifecycle_json: string;
}>;
