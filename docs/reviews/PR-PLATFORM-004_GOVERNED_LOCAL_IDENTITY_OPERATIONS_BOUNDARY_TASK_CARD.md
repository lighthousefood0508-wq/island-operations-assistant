# PR-PLATFORM-004 — Governed Local Identity Operations Boundary

Approval record: DECISIONS #093.

## Responsibility

Provide a local, offline, operator-only CLI for governed ROS identity create, password rotation plus revoke-all-sessions, and enable/disable operations. No HTTP/UI account management is included.

## Contract

- Roles are exactly `admin`, `pos`, `kitchen`, `closeout`.
- Password input is hidden TTY or explicitly protected stdin only; arguments and environment input are rejected.
- Rotation atomically updates the password hash and revokes every active session of its target user.
- Create, rotation, enable/disable and all rejected operations produce redacted evidence only.
- Production configuration must validate through the existing runtime loader before any mutation.

## Boundaries and exclusions

Reuse existing Authentication validation, hashing and repository authority. No schema/migration/package/UI/API/OAuth/SSO/self-registration/email reset/new role, and no direct SQLite script is allowed.

## Verification

Cover valid roles, duplicate/unsupported/weak input, rotation old/new credential behavior, target-only session revocation, transaction rollback, secret redaction, production fail-closed behavior, architecture guards, full repository verification, compiled tests, and E2E regression.
