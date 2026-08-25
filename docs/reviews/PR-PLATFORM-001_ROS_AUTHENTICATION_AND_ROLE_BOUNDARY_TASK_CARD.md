# PR-PLATFORM-001 — ROS Authentication and Role Boundary

## Constitution Compatibility Gate

- **Reviewed authority**: Constitution v3 System/Shared ownership and exclusive
  business-domain ownership; DECISIONS #017/#018 runtime preparation,
  #087/#088/#089 Operations boundaries, and DECISIONS #090.
- **Compatibility result**: PASS. System authentication gates HTTP access and
  command provenance without creating a business Domain, changing a business
  lifecycle, reading business persistence from System code, or modifying any
  frozen cross-Domain contract.

## Single responsibility

Provide local credentialed authentication, role authorization, server-side
session management, CSRF-origin protection, and trustworthy HTTP command actor
binding for ROS. It is an access-control envelope around existing authorities;
it is not user-administration product work or a replacement business service.

## Required contract

- Migration 023 extends existing System identity records only. It creates
  `system_auth_sessions`, stores credential metadata/hash/salt on `users`, and
  seeds only the four stable role codes `admin`, `pos`, `kitchen`, and
  `closeout` without changing existing users, roles, user-role assignments, or
  business evidence.
- Credential hashing uses Node `scrypt`, a per-user random salt, stored
  algorithm parameters, and timing-safe comparison. Session cookies carry a
  random opaque bearer; persistence receives only its SHA-256 digest. Expired
  or revoked sessions are rejected and never restored from browser state.
- A required runtime bootstraps one Administrator only when it has no
  credentialed user and valid environment-only bootstrap login/password values.
  It must not reset, overwrite, or silently attach a password to an existing
  user. Otherwise absence of a credentialed user fails closed.
- Required-mode endpoints:
  - `GET /login` renders a minimal same-origin login form.
  - `POST /api/auth/login` creates a session and returns a safe principal.
  - `POST /api/auth/logout` revokes the presented session and clears its cookie.
  - `GET /api/auth/session` returns the safe current principal.
  - anonymous API access returns `401 authentication_required`; invalid login
    returns `401 authentication_invalid`; insufficient role returns
    `403 authorization_forbidden`; malformed login/session request returns a
    safe 422/400 code as appropriate; technical failures return a safe 500.
- HTML routes redirect unauthenticated requests to a same-origin `/login?next=`
  value. All unsafe required-mode browser requests require a matching Origin;
  cookie policy is HttpOnly/SameSite=Strict and Secure when configuration says
  the runtime is secure.
- Route roles are policy only: Admin surfaces/API and diagnostics require
  `admin`; POS commands/views require `pos`; Kitchen production requires
  `kitchen`; closeout/lifecycle reports require `closeout`; `admin` is a
  superset. Unknown protected routes fail closed.
- In required mode the authenticated stable user ID replaces client-supplied
  audit-identity members before existing command delegation. It must not alter
  any non-audit command fact or duplicate Domain validation.

## Exact implementation allowlist (19 paths)

1. `migrations/023_platform_authentication.sql`
2. `src/config/runtime.ts`
3. `src/system/authentication/domain/authentication-repository.ts`
4. `src/system/authentication/application/authentication-service.ts`
5. `src/system/authentication/application/authentication-errors.ts`
6. `src/system/authentication/infrastructure/sqlite-authentication-repository.ts`
7. `src/system/authentication/index.ts`
8. `src/server/app/access-control.ts`
9. `src/server/app/login-page.ts`
10. `src/server/app/routes.ts`
11. `src/server/index.ts`
12. `src/tests/authentication-application.test.ts`
13. `src/tests/authentication-persistence.integration.test.ts`
14. `src/tests/authentication-api.integration.test.ts`
15. `src/tests/architecture-guards.test.ts`
16. `scripts/migration-upgrade-014.mjs`
17. `src/tests/recipe-migration-017.integration.test.ts`
18. `src/tests/recipe-migration-018.integration.test.ts`
19. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`

No twentieth implementation path is authorized.

## Acceptance criteria

- Required mode protects all non-public REST, HTML, SSE, and diagnostics routes;
  disabled local/test mode preserves existing test/client behavior exactly.
- Valid bootstrap/login produces an opaque HttpOnly session; password and token
  data are never returned, logged, or persisted in clear text.
- Role policy distinguishes Admin, POS, Kitchen, and Closeout paths; no role is
  derived from query parameters, browser storage, or request-body actor data.
- Unsafe cross-origin requests fail before business delegation. Required-mode
  command audit identity is the authenticated principal, not a caller value.
- Session expiry/revocation, wrong password, unknown/disabled user, malformed
  credentials, role denial, and persistence failures return stable safe results
  and produce no unintended business writes.
- Migration upgrades preserve existing System and all business rows, tolerate a
  restart/rerun, and retain foreign-key integrity.
- Architecture Guards reject a simulated twentieth substantive Authentication
  responsibility path using the same classifier used for the repository scan.

## Explicit exclusions

- User-management UI/API, role editing, password reset/recovery, SSO/OIDC,
  OAuth, MFA, API keys, multi-tenant/SaaS identity, provider identity,
  deployment/hosting, package additions, external credentials, and Legacy;
- business role/lifecycle changes to Catalog, Ingredient, Measurement, Recipe,
  Operations, Cost, Payment, Event Close, Price, Snapshot, History, Analytics,
  Inventory, Orders, Kitchen, or POS;
- Product/Sales Contract changes, migration runner changes, UI redesign, and
  browser-local authorization truth.

## Required verification

- Focused authentication Application, persistence, and API tests; role-policy,
  Origin/CSRF, session-revocation/expiry, safe failure, and actor-binding tests.
- Migration 014-to-023 populated upgrade, restart/rerun, foreign-key and
  existing-business-record preservation tests.
- Existing Operations, Cost, Ingredient, Recipe, API, E2E, and realtime
  regressions; Architecture Guards; typecheck/lint/build; `npm test`,
  `npm run verify`, `npm run verify:full`, compiled collection,
  `git diff --check`, exact 19-path audit, UTF-8, final newline, and no trailing
  whitespace.

## Stop conditions

Stop for a twentieth path, any shared contract change, user-management scope,
external identity/deployment scope, a business-authority change, migration
runner change, package addition, unsafe data migration, or an authentication
design conflict with DECISIONS #090.
