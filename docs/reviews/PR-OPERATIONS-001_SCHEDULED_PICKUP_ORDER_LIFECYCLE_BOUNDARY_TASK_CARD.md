# PR-OPERATIONS-001 — Scheduled Pickup Order Lifecycle Boundary

## Constitution Compatibility Gate

- **Reviewed ADR / authority**: Constitution v3 Operations ownership; DECISIONS
  #004 Order Core, #007 Order Lifecycle, #010 state separation, and #087.
- **Compatibility result**: PASS.  The work retains the existing Operations
  Order authority and its Event-product snapshots.  It adds no new domain,
  cross-domain table access, browser authority, migration, or external
  integration.

## Single responsibility

Replace the legacy `pickupTime` command member with a formal nullable
`scheduledPickupAt` instant on the existing POS Order command.  This makes a
scheduled pickup a server-validated Operations fact while retaining the same
Order, Product snapshot, sellable-inventory, Kitchen, payment, no-show,
closeout, and daily-report lifecycle.

## Contract

- `scheduledPickupAt: null` creates an ordinary onsite Order.
- A non-null value is an offset-bearing ISO-8601 instant.  Operations validates
  that it lies within the requesting Event's local operating interval; overnight
  Events retain their established next-date interpretation.
- The client may derive an offered instant from Event date and a selected clock
  time, but the server is authoritative.  Invalid/mismatched/outside-event
  commands produce the existing safe validation error shape and zero writes.
- The exact nullable instant participates in the idempotency fingerprint.
- A scheduled Order is unpaid at creation and otherwise uses the unchanged
  confirmed Order lifecycle.  It remains visible through the existing Kitchen
  preparation/upcoming projections and persists into statistics and closeout.

## Exact implementation allowlist

1. `src/domains/operations/domain/types.ts`
2. `src/domains/operations/application/order-service.ts`
3. `src/web/pos/page.ts`
4. `src/tests/order-core.test.ts`
5. `src/tests/order-core-api.integration.test.ts`
6. `src/tests/lifecycle-api.integration.test.ts`
7. `tests/e2e/pos-ordering.spec.ts`
8. `src/tests/architecture-guards.test.ts`

No ninth implementation path is authorized.

## Exclusions

- a Reservation/Customer/Kiosk aggregate or a second Order authority;
- new routes, migration/schema, repository, persistence, runtime composition,
  Kitchen implementation, Payment/provider/reconciliation, printer, webhook,
  physical Inventory, Cost, package, or deployment work;
- changes to Product/version/price snapshot, stock, cancellation/no-show,
  release, payment, closeout, or daily-report semantics.

## Acceptance and verification

- The command accepts only formal `scheduledPickupAt`, preserves `null` onsite
  Orders, validates Event-local timing, and includes it in idempotency.
- Kitchen receives the same stored instant and preserves its existing queue and
  reminder behavior; closeout/statistics retain it without rewriting it.
- POS renders and submits the formal instant safely; no browser state becomes
  authoritative.
- Architecture Guard protects the exact eight-path boundary and catches a
  simulated ninth substantive path with the same classifier.
- Run typecheck, lint, build, focused Order/API/lifecycle tests, POS/Kitchen
  E2E, Architecture Guards, `npm test`, `npm run verify`, `npm run verify:full`,
  compiled collection, `git diff --check`, text-hygiene, and scope audits.
