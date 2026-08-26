# PR-PLATFORM-003 — Backup, Restore, Monitoring, and Operational Recovery Evidence Boundary

## Constitution Compatibility Gate

- **Reviewed authority**: Constitution v3 System/Shared boundary; DECISIONS #090, #091, and #092.
- **Compatibility result**: PASS. This is System operational evidence around the existing single-host SQLite runtime. It creates no Domain authority, business fact, cross-Domain query, schema, migration, frozen contract, or browser-facing capability.

## Single responsibility

Provide one verifiable, local operational-recovery chain for the existing ROS SQLite database: consistent backup → manifest/hash/integrity verification → non-live restore drill → local health/backup-freshness evidence.

## Required behavior

- Production requires absolute backup configuration that is distinct from the database path. Local/test obtain isolated safe defaults.
- A backup is created through the SQLite backup facility into a temporary file; it must pass `PRAGMA integrity_check`, current-migration verification, and SHA-256 manifest creation before atomic publication. A failure must preserve prior published recovery evidence.
- Retention may remove only complete older backup/manifest pairs after a newer verified pair exists. It must never delete a manifest's pinned file independently or treat temporary data as a valid backup.
- Restore verifies the manifest's file identity and SHA-256, writes only an explicit target via a temporary file, and validates the target's integrity and migration currency. It refuses the configured live target unless an explicit destructive replacement flag is supplied; it never starts/stops a process or applies migrations.
- A recovery drill restores only to a non-live target. Production live restoration remains an Operator maintenance-window operation after the ROS service is stopped.
- Monitoring uses the existing loopback `/health` endpoint and latest complete backup manifest. It emits bounded JSON suitable for journald and returns non-zero for an unhealthy endpoint, missing manifest, checksum mismatch, or stale artifact. It creates no alert destination or UI.

## Exact implementation allowlist (19 paths)

1. `.env.example`
2. `package.json`
3. `src/config/runtime.ts`
4. `src/shared/database/database-adapter.ts`
5. `src/shared/database/better-sqlite3-adapter.ts`
6. `scripts/production-backup.mjs`
7. `scripts/production-restore-verify.mjs`
8. `scripts/production-monitoring-evidence.mjs`
9. `deploy/systemd/desert-island-ros-backup.service`
10. `deploy/systemd/desert-island-ros-backup.timer`
11. `deploy/systemd/desert-island-ros-monitoring.service`
12. `deploy/systemd/desert-island-ros-monitoring.timer`
13. `docs/deployment/ROS_PRODUCTION_BACKUP_RECOVERY_LINUX.md`
14. `docs/deployment/ROS_PRODUCTION_RUNTIME_LINUX.md`
15. `docs/10_SECURITY.md`
16. `src/tests/production-backup-recovery.integration.test.ts`
17. `src/tests/production-monitoring-evidence.integration.test.ts`
18. `src/tests/runtime-configuration.test.ts`
19. `src/tests/architecture-guards.test.ts`

No twentieth implementation path is authorized.

## Acceptance criteria

- Backup output is consistent, integrity-checked, migration-current, hashed, atomically published, and paired with a complete manifest.
- A tampered/missing backup or manifest fails closed. A verified restore drill creates a separately validated target without touching the live database.
- Retention is deterministic and removes only complete older pairs after a valid new pair exists.
- Monitoring distinguishes healthy, unavailable, missing, tampered, and stale recovery evidence without emitting database contents, secrets, or raw errors.
- Production configuration rejects relative/equal backup paths and invalid retention/freshness values.
- The supplied systemd templates use the unprivileged service account, explicit environment file, restrictive filesystem surface, and bounded timer cadence.
- The Architecture Guard rejects a simulated unauthorized twentieth substantive recovery-responsibility path through the same classifier used for the repository scan.

## Explicit exclusions

- Database migration/schema/data changes; encryption implementation; off-host copy; cloud storage; external monitoring/alerting; UI/dashboard; credentials; automatic live restore; process control; release/deployment execution; rollback; containers/HA; Inventory; LINE Ordering; Cost/Operations/Recipe/Ingredient/Measurement changes; and Legacy work.

## Required verification

- Focused backup/restore/monitoring/configuration tests, including tamper, stale, retention, live-target refusal, and no-write-on-failure cases.
- Existing runtime, authentication, migration, Operations, Cost, Ingredient, Recipe, API, realtime, and E2E regressions.
- Architecture Guards, typecheck, lint, build, `npm test`, `npm run verify`, `npm run verify:full`, compiled repository collection, `git diff --check`, exact 19-path audit, UTF-8/final-newline/trailing-whitespace checks.

## Stop conditions

Stop for a twentieth path; any migration/schema/package/UI/business-domain or protected-contract change; a need to add encryption, cloud, alerting, release, or process-control behavior; an unsafe live restore flow; unsafe Git state; candidate identity drift; or a verification failure that cannot be resolved inside this exact scope.
