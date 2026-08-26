import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../dist/config/runtime.js";
import { createDatabase } from "../dist/shared/database/database-provider.js";
import { verifyMigrationsCurrent } from "../dist/shared/database/migrate.js";

function sha256(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function readManifest(manifestPath, backupPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (path.basename(backupPath) !== manifest?.backupFile || !/^[a-f0-9]{64}$/.test(manifest.sha256 ?? "") || !Number.isSafeInteger(manifest.byteSize)) {
    throw new Error("backup manifest is invalid");
  }
  if (!existsSync(backupPath) || statSync(backupPath).size !== manifest.byteSize || sha256(backupPath) !== manifest.sha256) {
    throw new Error("backup artifact does not match its manifest");
  }
  return manifest;
}

function integrityCheck(database) {
  const result = database.queryOne("PRAGMA integrity_check");
  if (!result || Object.values(result)[0] !== "ok") throw new Error("restored database integrity check failed");
}

export function restoreAndVerify(config = loadConfig(), options = {}) {
  const configuredBackupPath = options.backupPath ?? process.env.ROS_RECOVERY_BACKUP_PATH;
  const configuredTargetPath = options.targetPath ?? process.env.ROS_RECOVERY_TARGET_PATH;
  if (!configuredBackupPath || !configuredTargetPath) throw new Error("recovery backup and target paths are required");
  const backupPath = path.resolve(configuredBackupPath);
  const targetPath = path.resolve(configuredTargetPath);
  const manifestPath = path.resolve(options.manifestPath ?? process.env.ROS_RECOVERY_MANIFEST_PATH ?? `${backupPath}.manifest.json`);
  const replaceLive = options.replaceLive ?? process.argv.includes("--replace-live-database");
  if (!path.isAbsolute(backupPath) || !path.isAbsolute(targetPath) || !path.isAbsolute(manifestPath)) throw new Error("recovery paths must be absolute");
  if (backupPath === targetPath) throw new Error("recovery target must differ from backup artifact");
  if (targetPath === config.databasePath && !replaceLive) throw new Error("live database replacement requires explicit confirmation");
  readManifest(manifestPath, backupPath);
  mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  const temporaryTarget = `${targetPath}.restore-tmp`;
  rmSync(temporaryTarget, { force: true });
  try {
    copyFileSync(backupPath, temporaryTarget);
    const restored = createDatabase({ ...config, databasePath: temporaryTarget });
    try {
      integrityCheck(restored);
      verifyMigrationsCurrent(restored);
    } finally {
      restored.close();
    }
    renameSync(temporaryTarget, targetPath);
    return { targetPath, restoredAt: new Date().toISOString() };
  } catch (error) {
    rmSync(temporaryTarget, { force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = restoreAndVerify();
    console.log(JSON.stringify({ ok: true, targetPath: result.targetPath, restoredAt: result.restoredAt }));
  } catch {
    console.error(JSON.stringify({ ok: false, code: "restore_verification_failed" }));
    process.exitCode = 1;
  }
}
