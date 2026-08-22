export class CostPurchaseValidationFailure extends Error { readonly code="COST_PURCHASE_VALIDATION_FAILURE"; constructor(){super("Purchase command is invalid.");} }
export class CostPurchaseNotFound extends Error { readonly code="COST_PURCHASE_NOT_FOUND"; constructor(){super("Purchase was not found.");} }
export class CostPurchaseInvalidStateFailure extends Error { readonly code="COST_PURCHASE_INVALID_STATE"; constructor(){super("Purchase is not editable in its current state.");} }
export class CostPurchaseVersionConflictFailure extends Error { readonly code="COST_PURCHASE_VERSION_CONFLICT"; constructor(){super("Purchase version conflict.");} }
export class CostPurchasePersistenceFailure extends Error { readonly code="COST_PURCHASE_PERSISTENCE_FAILURE"; constructor(){super("Purchase persistence failed.");} }
