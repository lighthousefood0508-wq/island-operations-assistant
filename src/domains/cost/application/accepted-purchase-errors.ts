export class AcceptedPurchaseValidationFailure extends Error { readonly code="ACCEPTED_PURCHASE_VALIDATION_FAILURE"; constructor(){super("Accepted Purchase command is invalid.");} }
export class AcceptedPurchaseNotFound extends Error { readonly code="ACCEPTED_PURCHASE_NOT_FOUND"; constructor(){super("Purchase was not found for acceptance.");} }
export class AcceptedPurchaseInvalidStateFailure extends Error { readonly code="ACCEPTED_PURCHASE_INVALID_STATE"; constructor(){super("Purchase cannot be accepted in its current state.");} }
export class AcceptedPurchaseVersionConflictFailure extends Error { readonly code="ACCEPTED_PURCHASE_VERSION_CONFLICT"; constructor(){super("Purchase version conflict.");} }
export class AcceptedPurchaseMeasurementFailure extends Error { readonly code="ACCEPTED_PURCHASE_MEASUREMENT_FAILURE"; constructor(){super("Accepted Purchase measurement could not be resolved.");} }
export class AcceptedPurchasePersistenceFailure extends Error { readonly code="ACCEPTED_PURCHASE_PERSISTENCE_FAILURE"; constructor(){super("Accepted Purchase persistence failed.");} }
