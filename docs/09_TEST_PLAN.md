# Test Plan

Current automated coverage: a Node test creates an isolated SQLite database, starts the server, and verifies `/health` returns `200` plus `status: ok`.

Foundation verification: `typecheck`, `lint`, `test`, `build`, migration rerun, health request, SSE connection, and opening four placeholder routes.

Future tests: migration upgrade/downgrade rehearsal, order-state transition tests, idempotency/retry tests, allocation race tests, authorization tests, audit assertions, integration contract tests, browser smoke tests, backup restore drills, and production health checks.
