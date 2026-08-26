import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../dist/config/runtime.js";

function sha256(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function latestBackupEvidence(backupDirectory) {
  if (!existsSync(backupDirectory)) return null;
  const manifests = readdirSync(backupDirectory)
    .filter((name) => name.endsWith(".manifest.json"))
    .flatMap((name) => {
      try {
        const manifest = JSON.parse(readFileSync(path.join(backupDirectory, name), "utf8"));
        const backupPath = path.resolve(backupDirectory, manifest?.backupFile ?? "");
        if (path.dirname(backupPath) !== path.resolve(backupDirectory) || typeof manifest.createdAt !== "string") return [];
        if (!existsSync(backupPath)) return [{ manifest, status: "missing" }];
        if (statSync(backupPath).size !== manifest.byteSize || sha256(backupPath) !== manifest.sha256) return [{ manifest, status: "tampered" }];
        return [{ manifest, status: "complete" }];
      } catch { return []; }
    })
    .sort((left, right) => right.manifest.createdAt.localeCompare(left.manifest.createdAt));
  return manifests[0] ?? null;
}

export async function collectMonitoringEvidence(config = loadConfig(), fetchImplementation = fetch) {
  const recovery = config.recovery;
  if (!recovery) throw new Error("recovery configuration is unavailable");
  const checkedAt = new Date().toISOString();
  const latest = latestBackupEvidence(recovery.backupDirectory);
  const ageHours = latest ? (Date.now() - Date.parse(latest.manifest.createdAt)) / 3_600_000 : null;
  const backup = latest?.status === "complete" && Number.isFinite(ageHours) && ageHours <= recovery.maximumBackupAgeHours
    ? { status: "current", createdAt: latest.manifest.createdAt, ageHours: Number(ageHours.toFixed(3)) }
    : { status: latest?.status === "complete" ? "stale" : latest?.status ?? "missing" };
  let health = "unavailable";
  try {
    const response = await fetchImplementation(`http://${config.host}:${config.port}/health`, { signal: AbortSignal.timeout(5_000) });
    const body = await response.json();
    if (response.ok && body?.data?.status === "ok" && body.data.database === "ready") health = "ok";
  } catch { /* safe operational evidence only */ }
  return { ok: health === "ok" && backup.status === "current", checkedAt, health, backup };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const evidence = await collectMonitoringEvidence();
    console.log(JSON.stringify(evidence));
    if (!evidence.ok) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ ok: false, health: "unavailable", backup: { status: "unavailable" } }));
    process.exitCode = 1;
  }
}
