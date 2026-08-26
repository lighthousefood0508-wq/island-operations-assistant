# PR-PLATFORM-002 — Production Runtime Configuration and Secure Deployment Boundary

## Constitution Compatibility Gate

- **Reviewed authority**: Constitution v3 System/Shared boundary; DECISIONS #017/#018 Cloudflare preparation, #046 ROS self-starting runtime, #090 ROS Authentication and Role Boundary, and #091.
- **Compatibility result**: PASS. This work hardens the System runtime envelope around existing authorities. It does not create a Domain, query a Domain table from a new owner, change a frozen contract, or transfer business truth to deployment tooling.

## Single responsibility

Make the existing single-process ROS runtime safe and deterministic to deploy behind HTTPS on one Linux host. The boundary covers only runtime configuration, release migration discipline, process shutdown, reverse-proxy/systemd templates, and associated verification.

## Required behavior

- Production requires `NODE_ENV=production`, `ROS_AUTH_MODE=required`, secure cookies, a canonical `https` public origin, loopback binding, and an absolute SQLite path. Invalid or missing production values fail before the server listens.
- The canonical public origin, not request `Host` or forwarded headers, is the unsafe-request Origin authority in production. Local/test keep the compatible existing same-origin behavior.
- Production startup only verifies migration currency. It must fail before listening if a repository migration is pending. The existing explicit migration command is the production release writer; local/test startup remains migration-applying for developer and test compatibility.
- `SIGTERM`/`SIGINT` trigger idempotent graceful HTTP shutdown and SQLite close. The runtime must not start a second process, rewrite history, or claim release/backup success.
- The systemd template runs the compiled application as an unprivileged service, uses a restrictive umask/sandbox, writes only to its SQLite state directory, and never embeds a secret.
- The Nginx template terminates TLS, redirects HTTP, limits login attempts and request size, supports long-lived unbuffered SSE, and forwards ordinary same-origin traffic only to loopback ROS.

## Exact implementation allowlist (17 paths)

1. `.env.example`
2. `package.json`
3. `src/config/runtime.ts`
4. `src/shared/database/migrate.ts`
5. `src/server/index.ts`
6. `src/server/app/access-control.ts`
7. `src/system/authentication/application/authentication-service.ts`
8. `scripts/production-runtime-preflight.mjs`
9. `deploy/systemd/desert-island-ros.service`
10. `deploy/nginx/desert-island-ros.conf`
11. `docs/deployment/ROS_PRODUCTION_RUNTIME_LINUX.md`
12. `docs/10_SECURITY.md`
13. `src/tests/runtime-configuration.test.ts`
14. `src/tests/production-runtime.integration.test.ts`
15. `src/tests/authentication-api.integration.test.ts`
16. `src/tests/architecture-guards.test.ts`
17. `src/server/app/routes.ts` — only to pass the configured canonical public origin to the existing anonymous login same-origin check; no route selection or login behavior change.

The Decision #091 scope amendment authorizes no eighteenth implementation path.

## Acceptance criteria

- Production configuration rejects missing/invalid public origin, insecure cookies, disabled authentication, non-loopback binding, relative database paths, and invalid migration-start policy.
- Production cannot listen against a database with pending migrations; an explicit migration followed by startup succeeds without an additional migration write.
- Login/logout and all unsafe authenticated requests accept the configured canonical origin and reject another origin without disclosing internals.
- Secure production sessions set `HttpOnly`, `SameSite=Strict`, and `Secure`; no configuration value or secret serializes through an HTTP response.
- Shutdown closes server/database once and can be invoked repeatedly without a second close or a partial process state.
- Templates and preflight express one loopback app listener, HTTPS proxy, SSE behavior, constrained service account, and no committed secret.
- Architecture Guards reject a simulated unauthorized eighteenth substantive deployment-responsibility path using the same classifier as the repository scan.

## Explicit exclusions

- Migrations/schema/data rewrite, package addition, Docker/Kubernetes, multi-instance availability, TLS certificate issuance, production credentials, user administration, external identity, CORS, external API, rate-limit business authority, UI redesign, Domain authority, Cost/Operations/Recipe/Ingredient/Measurement changes, backup/restore, monitoring/alerting, release promotion, deployment execution, and Legacy.

## Required verification

- Focused runtime configuration, production server/migration, authentication API/origin/cookie, preflight/template, and Architecture Guard tests.
- Existing migration, authentication, Operations, Cost, Ingredient, Recipe, API, realtime, and E2E regressions.
- typecheck, lint, build, `npm test`, `npm run verify`, `npm run verify:full`, full compiled collection, `git diff --check`, exact 17-path audit, UTF-8/final-newline/trailing-whitespace checks.

## Stop conditions

Stop for an eighteenth path; migration/schema/package change; Domain/contract/UI authority expansion; backup/restore/monitoring work; a need to trust request-controlled proxy data; a public non-loopback Node listener; an unresolved production configuration or graceful-shutdown conflict; unsafe Git state; or a test failure that cannot be corrected inside this exact scope.
