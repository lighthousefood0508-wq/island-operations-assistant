import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  AuthenticationInvalidCredentials,
  AuthenticationIdentityDuplicate,
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
  createLocalUser(input: Parameters<AuthenticationRepository["createLocalUser"]>[0]): void {
    this.created += 1;
    this.credential = Object.freeze({ userId: input.userId, login: input.login, displayName: input.displayName, status: "active", passwordAlgorithm: input.passwordAlgorithm, passwordSalt: input.passwordSalt, passwordHash: input.passwordHash, roles: [input.role] });
  }
  rotatePasswordAndRevokeSessions(input: Parameters<AuthenticationRepository["rotatePasswordAndRevokeSessions"]>[0]): number {
    if (!this.credential) throw new Error("missing identity");
    this.credential = Object.freeze({ ...this.credential, passwordAlgorithm: input.passwordAlgorithm, passwordSalt: input.passwordSalt, passwordHash: input.passwordHash });
    const count = this.sessions; this.revoked += count; this.sessions = 0; return count;
  }
  setLocalUserStatus(input: Parameters<AuthenticationRepository["setLocalUserStatus"]>[0]): number {
    if (!this.credential) throw new Error("missing identity");
    this.credential = Object.freeze({ ...this.credential, status: input.status });
    const count = input.status === "disabled" ? this.sessions : 0; this.revoked += count; if (input.status === "disabled") this.sessions = 0; return count;
  }
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

test("local identity operations preserve role policy and rotate passwords with session revocation", () => {
  const repository = new MemoryAuthenticationRepository();
  const service = new AuthenticationService(repository, required);
  const created = service.createLocalUser({ login: "pos.user", displayName: "POS User", role: "pos", password: "initial-operator-password" });
  assert.equal(created.role, "pos");
  assert.throws(() => service.createLocalUser({ login: "pos.user", displayName: "Duplicate", role: "pos", password: "another-valid-password" }), AuthenticationIdentityDuplicate);
  assert.throws(() => service.createLocalUser({ login: "bad", displayName: "Bad", role: "owner", password: "short" }));
  for (const role of ["admin", "kitchen", "closeout"] as const) {
    const roleService = new AuthenticationService(new MemoryAuthenticationRepository(), required);
    assert.equal(roleService.createLocalUser({ login: `${role}.user`, displayName: role, role, password: "allowed-operator-password" }).role, role);
  }
  service.login({ login: "pos.user", password: "initial-operator-password" });
  const rotated = service.rotateLocalPassword({ login: "pos.user", password: "rotated-operator-password" });
  assert.equal(rotated.revokedSessionCount, 1);
  assert.throws(() => service.login({ login: "pos.user", password: "initial-operator-password" }), AuthenticationInvalidCredentials);
  assert.equal(service.login({ login: "pos.user", password: "rotated-operator-password" }).principal.login, "pos.user");
  assert.equal(service.setLocalUserStatus({ login: "pos.user", status: "disabled" }).revokedSessionCount, 1);
  assert.throws(() => service.login({ login: "pos.user", password: "rotated-operator-password" }), AuthenticationInvalidCredentials);
  assert.equal(service.setLocalUserStatus({ login: "pos.user", status: "active" }).status, "active");
  assert.equal(service.login({ login: "pos.user", password: "rotated-operator-password" }).principal.login, "pos.user");
});

test("local identity operator rejects argument and non-interactive password input without echoing it", () => {
  const fixture = "test-only-secret-must-not-echo";
  const executable = path.resolve("dist", "tools", "local-identity-operator.js");
  const argumentResult = spawnSync(process.execPath, [executable, "create", "--login", "operator.user", "--role", "pos", "--actor", "test", "--password", fixture], { encoding: "utf8" });
  assert.notEqual(argumentResult.status, 0);
  assert.equal(`${argumentResult.stdout}${argumentResult.stderr}`.includes(fixture), false);
  assert.match(argumentResult.stderr, /"success":false/);

  const incompleteProductionResult = spawnSync(process.execPath, [executable, "create", "--login", "operator.user", "--role", "pos", "--actor", "test"], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production" }
  });
  assert.notEqual(incompleteProductionResult.status, 0);
  assert.match(incompleteProductionResult.stderr, /"success":false/);

  const databasePath = path.resolve("data", "operator-non-interactive.sqlite");
  const backupDirectory = path.resolve("data", "operator-non-interactive-backups");
  try {
    const nonInteractiveResult = spawnSync(process.execPath, [executable, "create", "--login", "operator.user", "--role", "pos", "--actor", "test"], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        ROS_AUTH_MODE: "required",
        ROS_AUTH_SECURE_COOKIE: "true",
        ROS_PUBLIC_ORIGIN: "https://localhost",
        ROS_HOST: "127.0.0.1",
        ROS_DATABASE_PATH: databasePath,
        ROS_BACKUP_DIRECTORY: backupDirectory
      }
    });
    assert.notEqual(nonInteractiveResult.status, 0);
    assert.match(nonInteractiveResult.stderr, /"success":false/);
    assert.doesNotMatch(`${nonInteractiveResult.stdout}${nonInteractiveResult.stderr}`, /Password input requires a protected interactive TTY\.|operator-non-interactive\.sqlite/);
  } finally {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
    rmSync(backupDirectory, { recursive: true, force: true });
  }
});
