# ROS Production Runtime on Linux

Approval record: DECISIONS #091 / PR-PLATFORM-002.

## Boundary

This is a single-host ROS runtime: one Node process, one local SQLite database,
one unprivileged `ros` account, and Nginx as the public HTTPS reverse proxy.
It is not Docker/Kubernetes, a multi-node SQLite topology, a release promotion,
or a production deployment authorization. Verified local backup/recovery
evidence is defined separately by DECISIONS #092.

Node must bind only to `127.0.0.1:3090`. Nginx owns port 443 and TLS. Do not
expose the Node port publicly, forward arbitrary hosts to ROS, or use a
Cloudflare Quick Tunnel as a production endpoint.

## Required host preparation

1. Install Node 24, pnpm, Nginx, and a TLS certificate mechanism as root-owned
   host dependencies.
2. Create the `ros` service account, `/var/lib/desert-island-ros` state
   directory, and `/etc/desert-island-ros/ros.env` environment file. The state
   directory is writable only by `ros`; the environment file is readable only
   by the service account and privileged operators.
3. Build a reviewed release with `pnpm install --frozen-lockfile` and
   `pnpm run verify:full`. Place the compiled artifact under
   `/opt/desert-island-ros/current` without putting secrets in that tree.
4. Install the reviewed systemd and Nginx templates after replacing only the
   documented hostname/certificate placeholders. Validate Nginx before reload.

The template deliberately has no credentials, hostname, token, private key,
or database data. Do not commit an operator environment file.

## Production environment

The service supervisor supplies these values; ROS does not read `.env`:

```text
NODE_ENV=production
ROS_HOST=127.0.0.1
ROS_PORT=3090
ROS_DATABASE_PATH=/var/lib/desert-island-ros/ros.sqlite
ROS_AUTH_MODE=required
ROS_AUTH_SECURE_COOKIE=true
ROS_AUTH_SESSION_TTL_MINUTES=720
ROS_PUBLIC_ORIGIN=https://ROS_PUBLIC_HOSTNAME
ROS_BACKUP_DIRECTORY=/var/backups/desert-island-ros
ROS_BACKUP_RETENTION_COUNT=14
ROS_BACKUP_MAX_AGE_HOURS=26
ROS_BOOTSTRAP_ADMIN_LOGIN=<first-admin-login-only>
ROS_BOOTSTRAP_ADMIN_PASSWORD=<first-admin-password-only>
```

The bootstrap values are needed only when there is no credentialed local user.
After the initial administrator exists, remove them from the service
environment. Existing credentialed users are never reset by startup.

## Release and migration procedure

1. Run the preflight against the intended production environment:
   `pnpm run runtime:preflight`.
2. Stop the service only within the approved maintenance window.
3. Apply the already-reviewed migrations explicitly:
   `pnpm run migrate`.
4. Start/restart `desert-island-ros.service`; production startup verifies that
   no migration remains pending before it listens.
5. Verify only through HTTPS: `/health`, login, one authorized role route, and
   the SSE endpoint. Do not treat this document as proof that those external
   checks have run.

Executable rollback is allowed only when the release did not apply a migration.
After a migration, use the approved backup/recovery procedure; do not delete
SQLite/WAL files, replay old binaries against an unknown schema, or claim
database rollback from this boundary. See
`ROS_PRODUCTION_BACKUP_RECOVERY_LINUX.md`.

## Proxy and shutdown behavior

The Nginx template redirects HTTP, limits login attempts, bounds request
bodies, keeps SSE unbuffered, and proxies only to loopback. ROS validates the
canonical configured origin for unsafe authenticated requests; it does not
trust a forwarded host as CSRF authority.

systemd sends `SIGTERM` during stop. ROS stops accepting new HTTP work and
closes SQLite once. `TimeoutStopSec` remains the final host safeguard; no
script may kill an unrelated process.

## Deferred operational evidence

DECISIONS #092 owns verified local backup, restore-drill, retention, and
monitoring evidence. Encrypted/off-host storage, alert routing, host timer
observation, and a staffed restore exercise remain deployment-time evidence;
this document does not claim that they have occurred.
