# ROS Production Backup and Recovery on Linux

Approval record: DECISIONS #092 / PR-PLATFORM-003.

## Boundary

This procedure creates verified local SQLite recovery evidence for the single-host ROS runtime. It does not deploy ROS, encrypt a backup, copy data off-host, contact an alert service, roll back a migration, or authorize a live database replacement without an Operator maintenance window.

## Host preparation

1. Create `/var/backups/desert-island-ros` as `ros:ros` with mode `0700` on an Operator-approved encrypted storage volume.
2. Set the following non-secret values in `/etc/desert-island-ros/ros.env`:

   ```text
   ROS_BACKUP_DIRECTORY=/var/backups/desert-island-ros
   ROS_BACKUP_RETENTION_COUNT=14
   ROS_BACKUP_MAX_AGE_HOURS=26
   ```

3. Install the two service/timer pairs from `deploy/systemd/`, then run `systemctl daemon-reload` and enable the timers. The backup timer runs daily; the monitoring timer records health and backup freshness every five minutes in journald.

The configured backup directory must be distinct from `/var/lib/desert-island-ros`, must not be committed, and must not contain credentials. This repository does not prove encryption or off-host replication; those are production Operator controls.

## Backup evidence

Run `pnpm run production:backup` under the service environment. The command produces a SQLite file plus an adjacent JSON manifest only after it validates SQLite integrity, migration currency, file hash, and size. It reports only the backup identity and time.

Never copy `ros.sqlite`, `ros.sqlite-wal`, or `ros.sqlite-shm` manually while ROS is running. Do not treat a `.tmp` file, an unpaired manifest, or a file without a verified manifest as recovery evidence.

## Restore drill

Run a periodic drill to an explicit non-live location:

```text
ROS_RECOVERY_BACKUP_PATH=/var/backups/desert-island-ros/ros-....sqlite
ROS_RECOVERY_TARGET_PATH=/var/lib/desert-island-ros/recovery-drill/ros.sqlite
pnpm run production:restore:verify
```

The command verifies the manifest hash, creates a temporary target, validates target integrity and the full migration ledger, then atomically publishes the drill target. It refuses the configured live database path by default.

For an actual recovery, an Operator must first stop `desert-island-ros.service`, preserve the incident evidence, validate the selected backup, and provide the explicit `--replace-live-database` flag within the approved maintenance procedure. The script never stops a process, runs migrations, or starts ROS itself. After replacement, use the regular production preflight and startup sequence, then record the restore result externally.

## Monitoring evidence

`pnpm run production:monitor` checks only loopback `/health` and the most recent complete backup manifest against `ROS_BACKUP_MAX_AGE_HOURS`. It writes bounded JSON to stdout/journald and exits non-zero for unavailable health, missing recovery evidence, or stale recovery evidence. It does not send an alert; alert routing is an Operator deployment-time condition.

## Required deployment-time evidence

- Encrypted/access-controlled local backup storage and approved off-host copy policy.
- Installed and observed systemd timers, with recent successful journal evidence.
- A staffed non-live restore drill using the intended host release and a recorded result.
- HTTPS login, role-route, health, SSE, backup freshness, secret rotation, alert-routing, and rollback/recovery runbook checks.
