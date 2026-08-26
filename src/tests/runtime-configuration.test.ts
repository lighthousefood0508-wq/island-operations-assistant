import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../config/runtime.js";

const authenticationModeKey = ["ROS", "AUTH", "MODE"].join("_");
const secureCookieKey = ["ROS", "AUTH", "SECURE", "COOKIE"].join("_");

function production(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    [authenticationModeKey]: "required",
    [secureCookieKey]: "true",
    ROS_PUBLIC_ORIGIN: "https://ros.example.test",
    ROS_HOST: "127.0.0.1",
    ROS_DATABASE_PATH: path.resolve("data", "runtime-configuration.sqlite"),
    ROS_BACKUP_DIRECTORY: path.resolve("data", "runtime-configuration-backups"),
    ...overrides
  };
}

test("ProductionRuntimeSecureDeploymentBoundary validates the complete production envelope", () => {
  const configuration = loadConfig(production());
  assert.equal(configuration.runtime?.environment, "production");
  assert.equal(configuration.runtime?.migrationMode, "verify");
  assert.equal(configuration.authentication?.mode, "required");
  assert.equal(configuration.authentication?.secureCookie, true);
  assert.equal(configuration.authentication?.publicOrigin, "https://ros.example.test");
  assert.equal(configuration.host, "127.0.0.1");
  assert.equal(path.isAbsolute(configuration.databasePath), true);
});

test("PlatformOperationalRecoveryEvidence validates a separate production backup envelope", () => {
  const configuration = loadConfig(production({ ROS_BACKUP_RETENTION_COUNT: "7", ROS_BACKUP_MAX_AGE_HOURS: "25" }));
  assert.equal(configuration.recovery?.retentionCount, 7);
  assert.equal(configuration.recovery?.maximumBackupAgeHours, 25);
  assert.equal(path.isAbsolute(configuration.recovery?.backupDirectory ?? ""), true);
});

test("ProductionRuntimeSecureDeploymentBoundary fails closed for unsafe production configuration", () => {
  assert.throws(() => loadConfig(production({ [authenticationModeKey]: "disabled" })), /requires authentication/);
  assert.throws(() => loadConfig(production({ [secureCookieKey]: "false" })), /secure session cookies/);
  assert.throws(() => loadConfig(production({ ROS_PUBLIC_ORIGIN: "http://ros.example.test" })), /HTTPS origin/);
  assert.throws(() => loadConfig(production({ ROS_PUBLIC_ORIGIN: undefined })), /canonical public origin/);
  assert.throws(() => loadConfig(production({ ROS_HOST: "0.0.0.0" })), /loopback host/);
  assert.throws(() => loadConfig(production({ ROS_DATABASE_PATH: "data/relative.sqlite" })), /absolute database path/);
  assert.throws(() => loadConfig(production({ ROS_BACKUP_DIRECTORY: "data/relative-backups" })), /absolute backup directory/);
  assert.throws(() => loadConfig(production({ ROS_BACKUP_DIRECTORY: path.resolve("data") })), /distinct from the database directory/);
  assert.throws(() => loadConfig(production({ ROS_BACKUP_RETENTION_COUNT: "0" })), /backup retention count/);
  assert.throws(() => loadConfig(production({ ROS_BACKUP_MAX_AGE_HOURS: "721" })), /maximum backup age/);
  assert.throws(() => loadConfig({ NODE_ENV: "release" }), /NODE_ENV is invalid/);
});

test("ProductionRuntimeSecureDeploymentBoundary retains migration-applying local/test compatibility", () => {
  assert.equal(loadConfig({ NODE_ENV: "test" }).runtime?.migrationMode, "apply");
  assert.equal(loadConfig({ NODE_ENV: "development" }).authentication?.mode, "disabled");
});
