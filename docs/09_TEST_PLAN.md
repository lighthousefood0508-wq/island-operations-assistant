# Test Plan

Current automated coverage: a Node test creates an isolated SQLite database, starts the server, and verifies `/health` returns `200` plus `status: ok`.

Foundation verification: `typecheck`, `lint`, `test`, `build`, migration rerun, health request, SSE connection, and opening four placeholder routes.

Main Release Gate migration verification: `pnpm migration:upgrade:014` creates a disposable populated database at exactly migration 014, applies migrations 015 and 016 through the production migration runner, proves all pre-existing SQL values remain unchanged, verifies foreign keys and integrity, writes representative Profile and Recipe history, reopens the database, and proves restart persistence plus migration rerun idempotency. The fixture is created under the operating-system temporary directory and removed after success or failure; no repository or production database is used.

Future tests: migration downgrade rehearsal, order-state transition tests, idempotency/retry tests, allocation race tests, authorization tests, audit assertions, integration contract tests, browser smoke tests, backup restore drills, and production health checks.
