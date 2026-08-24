export class CostEvidenceReadValidationFailure extends Error {
  constructor() {
    super("Cost evidence identity is invalid.");
    this.name = "CostEvidenceReadValidationFailure";
  }
}

export class CostEvidenceReadNotFound extends Error {
  constructor() {
    super("Cost evidence was not found.");
    this.name = "CostEvidenceReadNotFound";
  }
}

export class CostEvidenceReadPersistenceFailure extends Error {
  constructor() {
    super("Cost evidence could not be read.");
    this.name = "CostEvidenceReadPersistenceFailure";
  }
}
