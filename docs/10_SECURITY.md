# Security

No secrets are committed. `.env` and SQLite runtime files are ignored by Git; `.env.example` contains placeholders only. ROS does not load `.env` itself; an approved process supervisor supplies any production environment values from a restricted operator-managed file.

DECISIONS #090 supplies authenticated sessions, role checks, CSRF-origin checks, and secure session-cookie policy. DECISIONS #091 adds the single-host runtime boundary: production binds Node only to loopback, requires required authentication, a canonical HTTPS public origin, `Secure` cookies, an absolute database path, and a reverse proxy that terminates TLS. Production CSRF checks use the configured canonical origin rather than a request-controlled Host header.

The approved Nginx template limits login attempts, bounds request bodies, keeps SSE unbuffered, and sends conservative transport headers. The application remains same-origin; it does not add a permissive CORS policy or trust arbitrary forwarded-host data.

DECISIONS #092 creates verified local SQLite backup manifests, non-live restore-drill validation, retention pairing, and bounded health/backup-freshness journal evidence. It does not create backup encryption, off-host replication, alert delivery, or a deployment claim. Before a production release, verify the approved systemd account/filesystem permissions, TLS certificate, explicit migration procedure, login/logout, role paths, health, SSE, rate-limit behavior, structured security logs, encrypted/access-controlled backup storage, off-host backup policy, restore verification, observed timers, alert routing, least-privilege service account, and secret rotation procedure.

Do not expose the SQLite file, server debug output, Google service credentials, LINE channel secret, or OpenAI key through a browser route. Receipt images and customer contact data require a retention policy before production use.
