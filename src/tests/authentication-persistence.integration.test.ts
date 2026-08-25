import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import { AuthenticationService, SqliteAuthenticationRepository } from "../system/authentication/index.js";

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
