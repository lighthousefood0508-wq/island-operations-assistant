import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations, verifyMigrationsCurrent } from "../shared/database/migrate.js";
import type { RosConfig } from "../config/runtime.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fixture() {
  const root = path.resolve("data", `platform-recovery-${randomUUID()}`);
  const databasePath = path.join(root, "ros.sqlite");
  const backupDirectory = path.join(root, "backups");
  const config: RosConfig = {
    host: "127.0.0.1",
    port: 0,
    databasePath,
    recovery: { backupDirectory, retentionCount: 2, maximumBackupAgeHours: 26 }
  };
  const database = createDatabase(config);
  try { runMigrations(database); } finally { database.close(); }
  return { root, databasePath, backupDirectory, config };
}

function run(script: string, env: NodeJS.ProcessEnv, arguments_: readonly string[] = []) {
  return spawnSync(process.execPath, [path.join(projectRoot, "scripts", script), ...arguments_], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", ...env }
  });
}

function environment(databasePath: string, backupDirectory: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ROS_DATABASE_PATH: databasePath,
    ROS_BACKUP_DIRECTORY: backupDirectory,
    ROS_BACKUP_RETENTION_COUNT: "2",
    ROS_BACKUP_MAX_AGE_HOURS: "26",
    ...extra
  };
}

function publishedManifest(backupDirectory: string): { backupFile: string } {
  const manifestName = readdirSync(backupDirectory).find((name) => name.endsWith(".manifest.json"));
  assert.ok(manifestName);
  return JSON.parse(readFileSync(path.join(backupDirectory, manifestName), "utf8")) as { backupFile: string };
}

test("PlatformOperationalRecoveryEvidence creates a verified backup and non-live restore drill", () => {
  const current = fixture();
  try {
    const backup = run("production-backup.mjs", environment(current.databasePath, current.backupDirectory));
    assert.equal(backup.status, 0, backup.stderr);
    const manifest = publishedManifest(current.backupDirectory);
    const backupPath = path.join(current.backupDirectory, manifest.backupFile);
    const targetPath = path.join(current.root, "restore-drill", "ros.sqlite");
    const restore = run("production-restore-verify.mjs", environment(current.databasePath, current.backupDirectory, {
      ROS_RECOVERY_BACKUP_PATH: backupPath,
      ROS_RECOVERY_TARGET_PATH: targetPath
    }));
    assert.equal(restore.status, 0, restore.stderr);
    assert.equal(existsSync(targetPath), true);
    const restored = createDatabase({ ...current.config, databasePath: targetPath });
    try { verifyMigrationsCurrent(restored); } finally { restored.close(); }
  } finally { rmSync(current.root, { recursive: true, force: true }); }
});

test("PlatformOperationalRecoveryEvidence fails closed for tampering and refuses the configured live target", () => {
  const current = fixture();
  try {
    assert.equal(run("production-backup.mjs", environment(current.databasePath, current.backupDirectory)).status, 0);
    const manifest = publishedManifest(current.backupDirectory);
    const backupPath = path.join(current.backupDirectory, manifest.backupFile);
    writeFileSync(backupPath, "tampered", { flag: "a" });
    const tampered = run("production-restore-verify.mjs", environment(current.databasePath, current.backupDirectory, {
      ROS_RECOVERY_BACKUP_PATH: backupPath,
      ROS_RECOVERY_TARGET_PATH: path.join(current.root, "restore-drill", "ros.sqlite")
    }));
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /restore_verification_failed/);
    const liveTarget = run("production-restore-verify.mjs", environment(current.databasePath, current.backupDirectory, {
      ROS_RECOVERY_BACKUP_PATH: backupPath,
      ROS_RECOVERY_TARGET_PATH: current.databasePath
    }));
    assert.notEqual(liveTarget.status, 0);
  } finally { rmSync(current.root, { recursive: true, force: true }); }
});

test("PlatformOperationalRecoveryEvidence retains only complete newer backup/manifest pairs", () => {
  const current = fixture();
  try {
    for (let index = 0; index < 3; index += 1) assert.equal(run("production-backup.mjs", environment(current.databasePath, current.backupDirectory)).status, 0);
    const names = readdirSync(current.backupDirectory);
    assert.equal(names.filter((name) => name.endsWith(".sqlite")).length, 2);
    assert.equal(names.filter((name) => name.endsWith(".manifest.json")).length, 2);
  } finally { rmSync(current.root, { recursive: true, force: true }); }
});
