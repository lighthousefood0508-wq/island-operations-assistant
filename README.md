# Desert Island ROS

Desert Island Restaurant Operating System (ROS) is an isolated restaurant foundation. Read [CONSTITUTION.md](CONSTITUTION.md) before changing code. The Legacy food truck project is not imported or modified.

The latest recorded local product release remains
[ROS v0.4](docs/releases/RELEASE_v0.4.md), tagged locally as
`v0.4-order-core`. It is historical release evidence and must not be confused
with the current development integration branch.

## Current development state - 2026-08-11

- Owner-Accepted Architecture Development Baseline and verified remote
  `integration/architecture-development` Head after PR #23:
  `ea46678cbb955b7aeb093dc34525c52325af9cae`.
- Recipe 001A and 001B are completed, independently reviewed, and merged.
- Recipe 001C through 001E remain unauthorized.
- The Canonical Ingredient Proposal is recorded. PR-INGREDIENT-003A command
  lifecycle, PR-INGREDIENT-003B management read/persistence/API work, and
  PR-INGREDIENT-003C management UI/navigation are technically complete and
  merged. Ingredient 003C governance closeout is being prepared and is not
  effective until independent review and a separately authorized merge. The
  Reference Impact Coordinator and Ingredient 003D remain unauthorized.
- Migration files 001 through 017 are present. Migration 017 is the
  forward-only Recipe persistence correction; Migration 016 remained
  unchanged during 001B.
- Cost Back Office is contained in the development integration ancestry but is
  not formally released or deployment-verified. The four Cost SQLite failures
  recorded during the earlier 466/470 diagnostic were corrected and closed by
  COST-REGRESSION-001 / PR #11; see the Test Plan for separate PR-head and
  post-merge evidence.
- Remote `main` does not exist. Local `main` remains unpromoted.

The accepted baseline identifies reviewed development capability through the
completed Ingredient 003C technical implementation. It does not identify a
deployed runtime, remote `main`, main promotion, or a product release. See
[Current Status](docs/CURRENT_STATUS.md),
[Architecture Development Baseline](docs/RELEASE_BASELINE.md), and the
[prepared Ingredient 003C Closeout Record](docs/reviews/PR-INGREDIENT-003C_CLOSEOUT_RECORD.md).

Recipe 001A provides stable Recipe Line identity, ordered repeated Ingredient
Lines, Draft editing behavior, and terminal abandonment at the Domain layer.
Recipe 001B adds forward-only persistence, durable receipts, persistence
Unit-of-Work operations, restart/rehydration coverage, and fail-closed current
Published Version pointer validation. The existing Cost Back Office
single-request create-and-publish route is not the proposed Recipe management
Application/API/UI workflow and does not constitute 001C through 001E.

Canonical Ingredient lifecycle management now has synchronous Rename and
Archive commands plus management list/detail/rename/archive APIs under
`/api/admin/canonical-ingredients`. The existing
`/api/admin/cost/ingredients` endpoint remains the Cost Back Office
creation-composition route; it is not a second lifecycle authority. The
management UI is available at `/admin/ingredients` and uses only that API.

## Historical 2026-07-26 Shadow Run context

This section records an earlier operating milestone. It is not the current Git,
runtime, deployment, or release identity.

The Shadow Run work is on `feature/20260726-shadow-run-mvp` under **DECISIONS #013** and is not merged into `main`. Legacy remains the primary operating system. ROS is a parallel validation system: POS, Kitchen, and closeout read and write only the central SQLite database through REST APIs. SSE announces changes; every screen reloads its data from the API after a notification. See [the on-site checklist](docs/acceptance/SHADOW_RUN_20260726.md).

The DECISIONS #016 hardening branch adds a small connection indicator and optional diagnostics to `/pos`, `/kitchen`, and `/pos/statistics`. Add `?device=POS-A&debug=1`, `?device=Kitchen-A&debug=1`, or `?device=Statistics&debug=1` when testing devices. The debug panel shows connection state, SSE state, polling fallback, last sync/event, reconnect count, server time, and central SQLite status. See [the realtime test checklist](docs/acceptance/SYNC_TEST.md).

DECISIONS #034 adds `/debug/devices`: a read-only live list of connected SSE devices, their page role, connection time, and most recent server activity. It is operational telemetry only, held in server memory; it does not write SQLite or affect Orders, Events, Catalog, Cost, or Legacy.

DECISIONS #035 separates the day-of-service screens by role. `/pos` is now the staff Front Office surface for ordering and order visibility only. `/kitchen` is the production surface and can update only production status. Back Office work lives under `/admin`: Catalog at `/admin`, Event setup at `/admin/events`, closeout/statistics at `/admin/statistics`, and health/share links at `/admin/health`. Financial closeout information is not shown on the POS main screen.

## Cloudflare Deployment Preparation

DECISIONS #017 prepares a dedicated ROS-only Cloudflare Tunnel without changing Legacy or creating a live Tunnel. The Windows host has non-secret start, stop, and readiness scripts; they refuse to start without an Owner-provided environment-only connector token and healthy ROS SQLite. The only remaining Owner actions are Cloudflare login and named-Tunnel authorization. See [Cloudflare Tunnel setup](docs/deployment/CLOUDFLARE_TUNNEL_SETUP.md).

### Architecture Owner Checklist

1. Log in to Cloudflare and authorize one dedicated ROS Shadow Run Tunnel.
2. Configure its ROS-only hostname and securely provide the connector token to the Windows host for the current session.

For temporary testing without a Cloudflare Zone, DECISIONS #018 uses a public Quick Tunnel on port 3092. It prints a changing `trycloudflare.com` address and does not modify ROS URLs, Legacy, or ngrok. See [Cloudflare Tunnel setup](docs/deployment/CLOUDFLARE_TUNNEL_SETUP.md).

For Windows login startup, use the ROS-only runtime scripts in `scripts/start-ros.ps1` and `scripts/stop-ros.ps1`. They run ROS on local port 3092, wait for central SQLite health, start the existing Quick Tunnel, and write the current public links to `runtime/ROS_CURRENT_LINKS.txt`. Setup and rollback instructions are in [ROS Windows runtime](docs/deployment/ROS_RUNTIME_WINDOWS.md).

For a local-network rehearsal, start ROS on the Windows host with `ROS_HOST=0.0.0.0` and `ROS_PORT=3090`, then allow inbound TCP 3090 in Windows Firewall on the private network. Find the host IPv4 address with `ipconfig`; on each iPad or Android device open `http://HOST-IP:3090/pos` or `http://HOST-IP:3090/kitchen`. Confirm every device returns the same `http://HOST-IP:3090/health` response before taking orders. `http://HOST-IP:3090/pos/statistics` is the owner-only closeout page. Do not use ngrok as the 7/26 production path.

If ROS becomes unavailable, stop entering orders into ROS, continue in Legacy only, and record the time, device, order number, and screenshot. Do not repair code during service. Restart the Windows ROS process only after the current Legacy transaction is safe.

## Phase 1C.1: POS Minimal UI

Catalog Admin is available at `/admin`. It creates categories, product drafts, channels, and immutable published product versions. Event Admin is available at `/admin/events`: create a draft Event, choose published products, enter planned sellable quantities, then open the Event. `/pos` reads only `GET /api/events/current/products`, and displays active `pos` products with `remainingQuantity > 0` from the one OPEN Event.

## Architecture Governance

An OPEN Event freezes its selected Product Contract v2 snapshot. Republishing a Catalog product never changes the live Event; the new product version can be selected only for a new draft Event. New phases, scope expansion, and contract changes require explicit Architecture Owner approval before implementation starts. See [ADR-013](docs/adr/ADR-013-open-event-product-snapshot-policy.md) and the [Architecture Timeline](docs/ARCHITECTURE_TIMELINE.md).

`POST /api/orders` creates a POS-only, confirmed/unpaid/not-started Order against the one OPEN Event. It atomically decrements Event sellable quantity, stores immutable item snapshots, assigns an Event-local number such as `YONG-001`, records `order.created`, and supports idempotent retry. `GET /api/orders/:orderId` returns only public Order fields and snapshots.

`/pos` now groups the open Event's POS products by frozen display category, shows POS short name, price, and remaining quantity, and provides a local shopping cart with quantity controls. **建立中央訂單** submits only to the existing Order API, shows the returned order number, then refreshes remaining quantity. It contains no payment, Kitchen, cancellation, discount, member, or promotion controls.

`/pos/lifecycle` is the Operations-only staff console for status changes, manual no-show, separately confirmed one-time inventory release, formal Event Close, and the stored daily report. It does not process payments or send Orders to Kitchen.

## Install and start

Requires Node.js 24 or later.

```powershell
npm install
npm run migrate
npm run dev
```

Open [Back Office Catalog](http://127.0.0.1:3090/admin), [Event Setup](http://127.0.0.1:3090/admin/events), [POS](http://127.0.0.1:3090/pos), [Kitchen](http://127.0.0.1:3090/kitchen), [Statistics](http://127.0.0.1:3090/admin/statistics), and [Back Office Health](http://127.0.0.1:3090/admin/health). Health is at `http://127.0.0.1:3090/health`.

## First product

1. Create an active category by entering only its display name, sort order, and active state; ROS generates the stable category code.
2. Create a product, fill display name, POS short name, price, and at least one channel.
3. Save the draft, then select **發布新版本**.
4. Create a draft Event in `/admin/events`, assign a positive planned quantity to published products, and open it.
5. Open `/pos`; only `pos` products with remaining quantity in the OPEN Event appear.

## POS Order API smoke check

Create a POS order with an Event ID and product/version IDs from `GET /api/events/current/products`. The client must generate and retain a unique `idempotencyKey` per submit attempt.

```json
{
  "source": "pos",
  "eventId": "event_xxx",
  "idempotencyKey": "pos-terminal-1-request-001",
  "items": [{ "productId": "prod_xxx", "productVersionId": "pver_xxx", "quantity": 1, "notes": null }],
  "customerName": null,
  "notes": null
}
```

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run architecture:guard`
- `npm run migration:smoke`: fresh database through migrations 001-017
- `npm run migration:upgrade:014`: populated migration-014 fixture upgraded
  through migrations 015-017, including restart and rerun checks
- `npm run verify`
- `npm run migrate`
- `npm run test:e2e`: isolated Chromium UI acceptance on port `3091`
- `npm run test:e2e:headed`: same E2E test with a visible browser
- `npm run test:e2e:ui`: Playwright UI mode
- `npm run verify:full`: quick verification plus E2E acceptance

The repository-configured `npm test` command is a named regression selection;
it is not described as every test file in `src/tests`. Focused Recipe,
Projection/Costing, migration/transaction, full-repository, Architecture Guard,
smoke, and upgrade selections overlap. Keep their results grouped and never add
them into a fictional total. See [Test Plan](docs/09_TEST_PLAN.md).

E2E runs use only `data/e2e-test.sqlite`, start their own server on `127.0.0.1:3091`, and remove the test database when finished. The development database and the `3090` server are never reused. Open `playwright-report/index.html` after a run for the HTML report; failure artifacts are saved under `test-results/`. Both paths are ignored by Git.

`better-sqlite3` is isolated behind `src/shared/database/`; it enables foreign keys, WAL, and a 5-second busy timeout. Product Contract v2 and Sales Contract v1 files in `src/shared/contracts/` are frozen and require explicit Architecture Owner approval before modification.
