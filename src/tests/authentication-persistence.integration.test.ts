import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import { AuthenticationPersistenceFailure, AuthenticationService, SqliteAuthenticationRepository } from "../system/authentication/index.js";

test("SQLite authentication repository persists only hashed opaque session evidence and revokes sessions", () => {
  const databasePath = path.resolve("data", `authentication-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  try {
    runMigrations(database);
    const service = new AuthenticationService(new SqliteAuthenticationRepository(database), {
      mode: "required",
      secureCookie: false,
      sessionTtlMinutes: 60,
      bootstrapAdministrator: { login: "admin", password: "correct-horse-battery" }
    });
    service.ensureBootstrap();
    const login = service.login({ login: "admin", password: "correct-horse-battery" });
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM system_auth_sessions WHERE token_hash = ?", [login.sessionToken])?.count, 0);
    assert.equal(service.authenticate(login.sessionToken).userId, login.principal.userId);
    service.logout(login.sessionToken);
    assert.throws(() => service.authenticate(login.sessionToken));
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM users WHERE password_hash = ?", ["correct-horse-battery"])?.count, 0);
  } finally {
    database.close();
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
  }
});

test("local password rotation revokes only the target user's sessions atomically", () => {
  const databasePath = path.resolve("data", `authentication-local-identity-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  try {
    runMigrations(database);
    const service = new AuthenticationService(new SqliteAuthenticationRepository(database), { mode: "required", secureCookie: false, sessionTtlMinutes: 60, bootstrapAdministrator: { login: "admin", password: "correct-horse-battery" } });
    service.ensureBootstrap();
    service.createLocalUser({ login: "pos.user", displayName: "POS User", role: "pos", password: "initial-operator-password" });
    const admin = service.login({ login: "admin", password: "correct-horse-battery" });
    const pos = service.login({ login: "pos.user", password: "initial-operator-password" });
    assert.equal(service.rotateLocalPassword({ login: "pos.user", password: "rotated-operator-password" }).revokedSessionCount, 1);
    assert.throws(() => service.authenticate(pos.sessionToken));
    assert.equal(service.authenticate(admin.sessionToken).login, "admin");
    assert.throws(() => service.login({ login: "pos.user", password: "initial-operator-password" }));
    assert.equal(service.login({ login: "pos.user", password: "rotated-operator-password" }).principal.login, "pos.user");
  } finally { database.close(); for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true }); }
});

test("local password rotation rolls back the password update when session revocation cannot complete", () => {
  const databasePath = path.resolve("data", `authentication-local-identity-rollback-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  try {
    runMigrations(database);
    const service = new AuthenticationService(new SqliteAuthenticationRepository(database), { mode: "required", secureCookie: false, sessionTtlMinutes: 60, bootstrapAdministrator: { login: "admin", password: "correct-horse-battery" } });
    service.ensureBootstrap();
    service.createLocalUser({ login: "pos.user", displayName: "POS User", role: "pos", password: "initial-operator-password" });
    const session = service.login({ login: "pos.user", password: "initial-operator-password" });
    const beforeHash = database.queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE login = 'pos.user'")?.password_hash;
    database.execute(`CREATE TRIGGER reject_target_session_revocation BEFORE UPDATE OF revoked_at ON system_auth_sessions
      WHEN NEW.user_id = (SELECT user_id FROM users WHERE login = 'pos.user')
      BEGIN SELECT RAISE(ABORT, 'forced test failure'); END`);
    assert.throws(() => service.rotateLocalPassword({ login: "pos.user", password: "rotated-operator-password" }), AuthenticationPersistenceFailure);
    assert.equal(database.queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE login = 'pos.user'")?.password_hash, beforeHash);
    assert.equal(service.authenticate(session.sessionToken).login, "pos.user");
  } finally { database.close(); for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true }); }
});
