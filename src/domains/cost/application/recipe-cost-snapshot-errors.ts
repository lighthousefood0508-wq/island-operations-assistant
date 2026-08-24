export class RecipeCostSnapshotValidationFailure extends Error { readonly code="RECIPE_COST_SNAPSHOT_VALIDATION_FAILURE"; constructor(){super("Recipe Cost Snapshot command is invalid.");} }
export class RecipeCostSnapshotPersistenceFailure extends Error { readonly code="RECIPE_COST_SNAPSHOT_PERSISTENCE_FAILURE"; constructor(){super("Recipe Cost Snapshot could not be persisted.");} }
