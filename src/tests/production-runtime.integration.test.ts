import assert from "node:assert/strict";
import { once } from "node:events";
import { rmSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closeRosServer, createRosServer } from "../server/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import type { RosConfig } from "../config/runtime.js";

function productionConfig(databasePath: string): RosConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    databasePath,
    authentication: {
      mode: "required",
      secureCookie: true,
      sessionTtlMinutes: 60,
      publicOrigin: "https://ros.example.test",
      bootstrapAdministrator: { login: "admin", password: "correct-horse-battery" }
    },
    runtime: { environment: "production", migrationMode: "verify" }
  };
}

function removeDatabase(databasePath: string): void {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
}

test("ProductionRuntimeSecureDeploymentBoundary refuses pending migrations, then starts after explicit migration and shuts down idempotently", async () => {
  const databasePath = path.resolve("data", `production-runtime-${randomUUID()}.sqlite`);
  const configuration = productionConfig(databasePath);
  try {
    assert.throws(() => createRosServer(configuration), /migration ledger is unavailable|pending migrations/);

    const database = createDatabase(configuration);
    try { runMigrations(database); } finally { database.close(); }

    const server = createRosServer(configuration);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    await closeRosServer(server);
    await closeRosServer(server);
    assert.equal(server.listening, false);
  } finally {
    removeDatabase(databasePath);
  }
});
