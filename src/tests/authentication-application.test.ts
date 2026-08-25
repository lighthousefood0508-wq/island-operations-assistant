import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthenticationInvalidCredentials,
  AuthenticationRequired,
  AuthenticationService,
  type AuthenticatedPrincipal,
  type AuthenticationCredential,
  type AuthenticationRepository
} from "../system/authentication/index.js";

class MemoryAuthenticationRepository implements AuthenticationRepository {
  credential: AuthenticationCredential | undefined;
  principal: AuthenticatedPrincipal | undefined;
  created = 0;
  sessions = 0;
  revoked = 0;

  findCredentialByLogin(): AuthenticationCredential | undefined { return this.credential; }
  findPrincipalByTokenHash(): AuthenticatedPrincipal | undefined { return this.principal; }
  hasCredentialedUser(): boolean { return this.credential !== undefined; }
  createBootstrapAdministrator(input: Parameters<AuthenticationRepository["createBootstrapAdministrator"]>[0]): void {
    this.created += 1;
    this.credential = Object.freeze({
      userId: input.userId,
      login: input.login,
      displayName: input.displayName,
      status: "active",
      passwordAlgorithm: input.passwordAlgorithm,
      passwordSalt: input.passwordSalt,
      passwordHash: input.passwordHash,
      roles: ["admin"]
    });
  }
  createSession(): void { this.sessions += 1; }
  revokeSession(): void { this.revoked += 1; }
}

const required = Object.freeze({
  mode: "required" as const,
  secureCookie: false,
  sessionTtlMinutes: 60,
  bootstrapAdministrator: Object.freeze({ login: "admin", password: "correct-horse-battery", displayName: "Owner" })
});

test("Authentication Service bootstraps once, issues opaque sessions, and rejects invalid credentials", () => {
  const repository = new MemoryAuthenticationRepository();
  const service = new AuthenticationService(repository, required);
  service.ensureBootstrap();
  service.ensureBootstrap();
  assert.equal(repository.created, 1);

  const login = service.login({ login: "admin", password: "correct-horse-battery" });
  assert.match(login.sessionToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(login.principal.login, "admin");
  assert.deepEqual(login.principal.roles, ["admin"]);
  assert.equal(repository.sessions, 1);
  assert.throws(() => service.login({ login: "admin", password: "not-the-password" }), AuthenticationInvalidCredentials);
  assert.equal(repository.sessions, 1);
  service.logout(login.sessionToken);
  assert.equal(repository.revoked, 1);
});

test("Authentication Service never enables login or sessions when authentication is disabled", () => {
  const service = new AuthenticationService(new MemoryAuthenticationRepository(), {
    mode: "disabled",
    secureCookie: false,
    sessionTtlMinutes: 60
  });
  service.ensureBootstrap();
  assert.throws(() => service.login({ login: "admin", password: "correct-horse-battery" }), AuthenticationRequired);
});
