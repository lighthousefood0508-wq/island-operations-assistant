import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../dist/config/runtime.js";
import { createDatabase } from "../dist/shared/database/database-provider.js";
import { verifyMigrationsCurrent } from "../dist/shared/database/migrate.js";

const MANIFEST_SUFFIX = ".manifest.json";

function sha256(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function integrityCheck(database) {
  const result = database.queryOne("PRAGMA integrity_check");
  if (!result || Object.values(result)[0] !== "ok") throw new Error("integrity check failed");
}

function parseManifest(filename, backupDirectory) {
  try {
    const manifest = JSON.parse(readFileSync(filename, "utf8"));
    const backupPath = path.resolve(backupDirectory, manifest?.backupFile ?? "");
    if (typeof manifest?.backupFile !== "string" || path.dirname(backupPath) !== path.resolve(backupDirectory)) return null;
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256 ?? "") || !Number.isSafeInteger(manifest.byteSize) || manifest.byteSize < 1 || typeof manifest.createdAt !== "string") return null;
    return manifest;
  } catch {
    return null;
  }
}

function completeBackupPairs(backupDirectory) {
  if (!existsSync(backupDirectory)) return [];
  return readdirSync(backupDirectory)
    .filter((name) => name.endsWith(MANIFEST_SUFFIX))
    .map((name) => ({ manifestPath: path.join(backupDirectory, name), manifest: parseManifest(path.join(backupDirectory, name), backupDirectory) }))
    .filter((entry) => entry.manifest !== null)
    .map((entry) => ({ ...entry, backupPath: path.join(backupDirectory, entry.manifest.backupFile) }))
    .filter((entry) => existsSync(entry.backupPath) && statSync(entry.backupPath).size === entry.manifest.byteSize)
    .sort((left, right) => right.manifest.createdAt.localeCompare(left.manifest.createdAt));
}

function retainCompletePairs(backupDirectory, retentionCount) {
  for (const pair of completeBackupPairs(backupDirectory).slice(retentionCount)) {
    rmSync(pair.backupPath, { force: true });
    rmSync(pair.manifestPath, { force: true });
  }
}

export async function createProductionBackup(config = loadConfig()) {
  const recovery = config.recovery;
  if (!recovery) throw new Error("recovery configuration is unavailable");
  const backupDirectory = recovery.backupDirectory;
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const name = `ros-${new Date().toISOString().replaceAll(/[:.]/g, "")}-${randomUUID()}.sqlite`;
  const backupPath = path.join(backupDirectory, name);
  const temporaryBackupPath = `${backupPath}.tmp`;
  const manifestPath = `${backupPath}${MANIFEST_SUFFIX}`;
  const temporaryManifestPath = `${manifestPath}.tmp`;
  const database = createDatabase(config);
  try {
    if (!database.backup) throw new Error("SQLite consistent backup is unavailable");
    await database.backup(temporaryBackupPath);
  } finally {
    database.close();
  }
  try {
    let manifest;
    const restored = createDatabase({ ...config, databasePath: temporaryBackupPath });
    try {
      integrityCheck(restored);
      verifyMigrationsCurrent(restored);
      const migrations = restored.queryMany("SELECT migration_id FROM schema_migrations ORDER BY migration_id").map((row) => row.migration_id);
      manifest = { version: 1, backupFile: name, sha256: sha256(temporaryBackupPath), byteSize: statSync(temporaryBackupPath).size, createdAt: new Date().toISOString(), migrations };
    } finally {
      restored.close();
    }
    renameSync(temporaryBackupPath, backupPath);
    writeFileSync(temporaryManifestPath, `${JSON.stringify(manifest)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryManifestPath, manifestPath);
    retainCompletePairs(backupDirectory, recovery.retentionCount);
    return manifest;
  } catch (error) {
    rmSync(temporaryBackupPath, { force: true });
    rmSync(temporaryManifestPath, { force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifest = await createProductionBackup();
    console.log(JSON.stringify({ ok: true, backupFile: manifest.backupFile, createdAt: manifest.createdAt }));
  } catch {
    console.error(JSON.stringify({ ok: false, code: "backup_failed" }));
    process.exitCode = 1;
  }
}
