export class AuthenticationValidationFailure extends Error {
  constructor() { super("Authentication input is invalid."); this.name = "AuthenticationValidationFailure"; }
}

export class AuthenticationInvalidCredentials extends Error {
  constructor() { super("Login credentials are invalid."); this.name = "AuthenticationInvalidCredentials"; }
}

export class AuthenticationRequired extends Error {
  constructor() { super("Authentication is required."); this.name = "AuthenticationRequired"; }
}

export class AuthenticationBootstrapFailure extends Error {
  constructor() { super("A credentialed Administrator must be configured before ROS can start."); this.name = "AuthenticationBootstrapFailure"; }
}

export class AuthenticationPersistenceFailure extends Error {
  constructor() { super("Authentication data could not be read or written."); this.name = "AuthenticationPersistenceFailure"; }
}
