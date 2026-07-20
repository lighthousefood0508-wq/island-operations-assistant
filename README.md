# Desert Island ROS

Desert Island Restaurant Operating System (ROS) is an isolated restaurant foundation. Read [CONSTITUTION.md](CONSTITUTION.md) before changing code. The Legacy food truck project is not imported or modified.

Current stable release: [ROS v0.4](docs/releases/RELEASE_v0.4.md), tagged locally as `v0.4-order-core`.

## 2026-07-26 Shadow Run

The Shadow Run work is on `feature/20260726-shadow-run-mvp` under **DECISIONS #013** and is not merged into `main`. Legacy remains the primary operating system. ROS is a parallel validation system: POS, Kitchen, and closeout read and write only the central SQLite database through REST APIs. SSE announces changes; every screen reloads its data from the API after a notification. See [the on-site checklist](docs/acceptance/SHADOW_RUN_20260726.md).

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

Open [Catalog Admin](http://127.0.0.1:3090/admin), [Event Admin](http://127.0.0.1:3090/admin/events), and [POS](http://127.0.0.1:3090/pos). Health is at `http://127.0.0.1:3090/health`.

## First product

1. Create an active category with a unique lowercase code.
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
- `npm run verify`
- `npm run migrate`
- `npm run test:e2e`: isolated Chromium UI acceptance on port `3091`
- `npm run test:e2e:headed`: same E2E test with a visible browser
- `npm run test:e2e:ui`: Playwright UI mode
- `npm run verify:full`: quick verification plus E2E acceptance

E2E runs use only `data/e2e-test.sqlite`, start their own server on `127.0.0.1:3091`, and remove the test database when finished. The development database and the `3090` server are never reused. Open `playwright-report/index.html` after a run for the HTML report; failure artifacts are saved under `test-results/`. Both paths are ignored by Git.

`better-sqlite3` is isolated behind `src/shared/database/`; it enables foreign keys, WAL, and a 5-second busy timeout. Product Contract v2 and Sales Contract v1 files in `src/shared/contracts/` are frozen and require explicit Architecture Owner approval before modification.
