export { AuthenticationService, type AuthenticationLoginResult, type LocalIdentityRole } from "./application/authentication-service.js";
export {
  AuthenticationBootstrapFailure,
  AuthenticationInvalidCredentials,
  AuthenticationPersistenceFailure,
  AuthenticationIdentityDuplicate,
  AuthenticationIdentityNotFound,
  AuthenticationRequired,
  AuthenticationValidationFailure
} from "./application/authentication-errors.js";
export { SqliteAuthenticationRepository } from "./infrastructure/sqlite-authentication-repository.js";
export type { AuthenticatedPrincipal, AuthenticationCredential, AuthenticationRepository } from "./domain/authentication-repository.js";
