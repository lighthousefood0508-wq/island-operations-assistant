# Phase 1C - POS Order Core

## Approved scope

Architecture Owner approved only the Operations POS Order Core: `source=pos` create/read APIs, immutable Event Product snapshots, Event-local order numbering, idempotency, atomic sellable quantity handling, and audit logging.

## Implementation

Migration `004_order_core.sql` is additive. Order creation runs in a SQLite IMMEDIATE transaction. It validates the OPEN Event and its Operations-owned product snapshot, performs a conditional `sold_quantity` update, allocates the next Event sequence, inserts Order and items, records idempotency, records `order.created`, then commits. Any failure rolls all of it back.

The idempotency fingerprint covers source, Event, normalized items, customer name, and Order notes. An identical retry returns the original Order without a quantity or audit side effect. A different payload for the same Event/source/key returns `409 IDEMPOTENCY_CONFLICT`.

## Explicitly excluded

No POS cart UI, payment, Kitchen, Customer/Kiosk, preorder, cancellation, refund, Sales Contract, Cost/BOM, inventory accounting, Google Sheets, LINE, n8n, jobs, or Legacy changes were made.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm architecture:guard`, `pnpm migration:smoke`, `pnpm verify`, and `pnpm verify:full`. Unit and integration tests include rollback, replay/conflict, snapshots, validation, and two requests competing for the final sellable portion.
