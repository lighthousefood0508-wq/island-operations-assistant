export type AuthenticationCredential = Readonly<{
  userId: string;
  login: string;
  displayName: string;
  status: string;
  passwordAlgorithm: string | null;
  passwordSalt: string | null;
  passwordHash: string | null;
  roles: readonly string[];
}>;

export type AuthenticatedPrincipal = Readonly<{
  userId: string;
  login: string;
  displayName: string;
  roles: readonly string[];
  expiresAt: string;
}>;

export interface AuthenticationRepository {
  findCredentialByLogin(login: string): AuthenticationCredential | undefined;
  findPrincipalByTokenHash(tokenHash: string, now: string): AuthenticatedPrincipal | undefined;
  hasCredentialedUser(): boolean;
  createBootstrapAdministrator(input: Readonly<{
    userId: string;
    login: string;
    displayName: string;
    passwordAlgorithm: string;
    passwordSalt: string;
    passwordHash: string;
    createdAt: string;
  }>): void;
  createSession(input: Readonly<{
    sessionId: string;
    tokenHash: string;
    userId: string;
    issuedAt: string;
    expiresAt: string;
  }>): void;
  revokeSession(tokenHash: string, revokedAt: string): void;
  createLocalUser(input: Readonly<{ userId: string; login: string; displayName: string; role: string; passwordAlgorithm: string; passwordSalt: string; passwordHash: string; createdAt: string }>): void;
  rotatePasswordAndRevokeSessions(input: Readonly<{ userId: string; passwordAlgorithm: string; passwordSalt: string; passwordHash: string; changedAt: string }>): number;
  setLocalUserStatus(input: Readonly<{ userId: string; status: "active" | "disabled"; changedAt: string }>): number;
}
