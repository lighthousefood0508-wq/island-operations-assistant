import assert from "node:assert/strict";
import { randomUUID, scryptSync } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

async function request(baseUrl: string, pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return { response, body: await response.json() as any };
}

test("required authentication protects operational routes, uses same-origin login/logout, and serializes no credential detail", async () => {
  const databasePath = path.resolve("data", `authentication-api-${randomUUID()}.sqlite`);
  const server = createRosServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    authentication: {
      mode: "required",
      secureCookie: false,
      sessionTtlMinutes: 60,
      bootstrapAdministrator: { login: "admin", password: "correct-horse-battery" }
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const blocked = await request(baseUrl, "/api/admin/cost/setup");
    assert.equal(blocked.response.status, 401);
    assert.equal(blocked.body.error.code, "authentication_required");

    const csrf = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://untrusted.example" },
      body: JSON.stringify({ login: "admin", password: "correct-horse-battery" })
    });
    assert.equal(csrf.response.status, 403);
    assert.equal(csrf.body.error.code, "csrf_origin_forbidden");

    const invalid = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ login: "admin", password: "wrong-password-value" })
    });
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.body.error.code, "authentication_invalid_credentials");
    assert.doesNotMatch(JSON.stringify(invalid.body), /sqlite|password|stack|cause/i);

    const login = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ login: "admin", password: "correct-horse-battery" })
    });
    assert.equal(login.response.status, 200);
    const cookie = login.response.headers.get("set-cookie");
    assert.match(cookie ?? "", /HttpOnly; SameSite=Strict/);
    assert.match(cookie ?? "", /ros_session=/);

    const setup = await request(baseUrl, "/api/admin/cost/setup", { headers: { cookie: cookie ?? "" } });
    assert.equal(setup.response.status, 200);
    const session = await request(baseUrl, "/api/auth/session", { headers: { cookie: cookie ?? "" } });
    assert.equal(session.response.status, 200);
    assert.equal(session.body.data.login, "admin");

    const logout = await request(baseUrl, "/api/auth/logout", { method: "POST", headers: { cookie: cookie ?? "", origin: baseUrl } });
    assert.equal(logout.response.status, 200);
    const revoked = await request(baseUrl, "/api/admin/cost/setup", { headers: { cookie: cookie ?? "" } });
    assert.equal(revoked.response.status, 401);
  } finally {
    server.close();
    await once(server, "close");
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
  }
});

test("role policy permits POS operational reads while denying Cost/Admin authority", async () => {
  const databasePath = path.resolve("data", `authentication-role-api-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  try {
    runMigrations(database);
    const salt = "0123456789abcdef0123456789abcdef";
    const hash = scryptSync("pos-operator-password", salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
    database.execute("INSERT INTO users (user_id, login, display_name, status, created_at, password_algorithm, password_salt, password_hash, password_changed_at) VALUES ('user_pos', 'pos.user', 'POS User', 'active', '2026-08-25T00:00:00.000Z', 'scrypt:N=16384,r=8,p=1,keylen=64', ?, ?, '2026-08-25T00:00:00.000Z')", [salt, hash]);
    database.execute("INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ('user_pos', 'role_pos', '2026-08-25T00:00:00.000Z')");
  } finally {
    database.close();
  }
  const server = createRosServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    authentication: { mode: "required", secureCookie: false, sessionTtlMinutes: 60 }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const login = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ login: "pos.user", password: "pos-operator-password" })
    });
    assert.equal(login.response.status, 200);
    const cookie = login.response.headers.get("set-cookie") ?? "";
    const eventRead = await request(baseUrl, "/api/events/current", { headers: { cookie } });
    assert.equal(eventRead.response.status, 200);
    const costRead = await request(baseUrl, "/api/admin/cost/setup", { headers: { cookie } });
    assert.equal(costRead.response.status, 403);
    assert.equal(costRead.body.error.code, "authorization_forbidden");
    const posCommand = await request(baseUrl, "/api/orders", {
      method: "POST",
      headers: { cookie, origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(posCommand.response.status, 400, "POS role reaches its governed Order boundary rather than being denied by authorization");
    const productionCommand = await request(baseUrl, "/api/orders/order_missing/status", {
      method: "PATCH",
      headers: { cookie, origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ status: "preparing" })
    });
    assert.equal(productionCommand.response.status, 404, "POS role may reach the existing production-state boundary without gaining Cost/Admin authority");
  } finally {
    server.close();
    await once(server, "close");
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
  }
});

test("ProductionRuntimeSecureDeploymentBoundary uses the configured canonical origin for anonymous login", async () => {
  const databasePath = path.resolve("data", `authentication-production-origin-${randomUUID()}.sqlite`);
  const canonicalOrigin = "https://ros.example.test";
  const server = createRosServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    authentication: {
      mode: "required",
      secureCookie: true,
      sessionTtlMinutes: 60,
      publicOrigin: canonicalOrigin,
      bootstrapAdministrator: { login: "admin", password: "correct-horse-battery" }
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const requestBody = JSON.stringify({ login: "admin", password: "correct-horse-battery" });
    const requestHeaders = { "content-type": "application/json" };
    const rejected = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { ...requestHeaders, origin: baseUrl },
      body: requestBody
    });
    assert.equal(rejected.response.status, 403);
    assert.equal(rejected.body.error.code, "csrf_origin_forbidden");

    const accepted = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { ...requestHeaders, origin: canonicalOrigin },
      body: requestBody
    });
    assert.equal(accepted.response.status, 200);
    assert.match(accepted.response.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict; Max-Age=3600; Secure/);
  } finally {
    server.close();
    await once(server, "close");
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
  }
});
