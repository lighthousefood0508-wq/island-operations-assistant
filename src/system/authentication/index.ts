export { AuthenticationService, type AuthenticationLoginResult } from "./application/authentication-service.js";
export {
  AuthenticationBootstrapFailure,
  AuthenticationInvalidCredentials,
  AuthenticationPersistenceFailure,
  AuthenticationRequired,
  AuthenticationValidationFailure
} from "./application/authentication-errors.js";
export { SqliteAuthenticationRepository } from "./infrastructure/sqlite-authentication-repository.js";
export type { AuthenticatedPrincipal, AuthenticationCredential, AuthenticationRepository } from "./domain/authentication-repository.js";
