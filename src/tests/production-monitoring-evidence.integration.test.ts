import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appendFileSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(script: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [path.join(projectRoot, "scripts", script)], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", ...env }
  });
}

async function waitForHealthy(url: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* retry while the isolated process starts */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("isolated ROS server did not become healthy");
}

test("PlatformOperationalRecoveryEvidence records healthy, stale, and unavailable local monitoring evidence", async () => {
  const root = path.resolve("data", `platform-monitoring-${randomUUID()}`);
  const databasePath = path.join(root, "ros.sqlite");
  const backupDirectory = path.join(root, "backups");
  const port = 31_000 + Math.floor(Math.random() * 1_000);
  const environment = { ROS_DATABASE_PATH: databasePath, ROS_BACKUP_DIRECTORY: backupDirectory, ROS_BACKUP_RETENTION_COUNT: "2", ROS_BACKUP_MAX_AGE_HOURS: "26", ROS_PORT: String(port) };
  const server = spawn(process.execPath, [path.join(projectRoot, "dist", "server", "index.js")], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "test", ...environment },
    stdio: "ignore"
  });
  let stopped = false;
  try {
    await waitForHealthy(`http://127.0.0.1:${port}/health`);
    assert.equal(run("production-backup.mjs", environment).status, 0);
    const healthy = run("production-monitoring-evidence.mjs", environment);
    assert.equal(healthy.status, 0, healthy.stderr);
    assert.equal((JSON.parse(healthy.stdout) as { ok: boolean }).ok, true);
    const manifestName = readdirSync(backupDirectory).find((name) => name.endsWith(".manifest.json"));
    assert.ok(manifestName);
    const manifestPath = path.join(backupDirectory, manifestName);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    appendFileSync(path.join(backupDirectory, String(manifest.backupFile)), "tampered");
    const tampered = run("production-monitoring-evidence.mjs", environment);
    assert.notEqual(tampered.status, 0);
    assert.equal((JSON.parse(tampered.stdout) as { backup: { status: string } }).backup.status, "tampered");
    manifest.createdAt = "1999-01-01T00:00:00.000Z";
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    assert.equal(run("production-backup.mjs", environment).status, 0);
    const freshManifestName = readdirSync(backupDirectory).find((name) => name.endsWith(".manifest.json") && name !== manifestName);
    assert.ok(freshManifestName);
    const freshManifestPath = path.join(backupDirectory, freshManifestName);
    const freshManifest = JSON.parse(readFileSync(freshManifestPath, "utf8")) as Record<string, unknown>;
    freshManifest.createdAt = "2000-01-01T00:00:00.000Z";
    writeFileSync(freshManifestPath, `${JSON.stringify(freshManifest)}\n`);
    const stale = run("production-monitoring-evidence.mjs", environment);
    assert.notEqual(stale.status, 0);
    assert.equal((JSON.parse(stale.stdout) as { backup: { status: string } }).backup.status, "stale");
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    stopped = true;
    const unavailable = run("production-monitoring-evidence.mjs", environment);
    assert.notEqual(unavailable.status, 0);
    assert.equal((JSON.parse(unavailable.stdout) as { health: string }).health, "unavailable");
  } finally {
    if (!stopped) server.kill("SIGTERM");
    rmSync(root, { recursive: true, force: true });
  }
});
