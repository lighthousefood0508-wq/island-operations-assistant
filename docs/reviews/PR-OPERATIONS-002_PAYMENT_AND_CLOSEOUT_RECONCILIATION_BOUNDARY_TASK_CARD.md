# PR-OPERATIONS-002 — Payment and Closeout Reconciliation Boundary

## Constitution Compatibility Gate

- **Reviewed ADR / authority**: Constitution v3 Operations ownership; DECISIONS
  #004 Order Core, #007 Order Lifecycle, #010 state separation, #012
  authoritative payment evidence, #013 Event closeout, #087, and #088.
- **Compatibility result**: PASS.  The work uses only existing Operations
  Payment, Event-closeout, Daily-Report, and audit authority.  It introduces no
  external financial integration, new domain, cross-domain data access, or
  browser authority.

## Single responsibility

Make Event Close explicitly reconcile existing Cash and LINE Pay payment
evidence against the declared closeout receipt values, preserving both sides as
immutable Daily Report evidence.  It does not change how a Payment is
confirmed, how a closeout declaration is saved, or what an Order costs.

## Contract

- Expected Cash and LINE Pay values are exact sums of existing `paid`
  Operations Payment records for the Event.  Declared values are the existing
  closeout's `cashReceived` and `linePayReceived`; `otherReceived` is reported
  separately and may not offset a method-specific difference.
- For each governed method, `variance = declared - expected`.  Both variances
  must be zero for outcome `matched`.
- A variance makes `POST /api/events/:eventId/close` fail with the safe
  reconciliation-exception-required response unless it carries
  `reconciliationException: { confirmed: true, reason }`, where `reason` is
  nonblank and bounded.  The accepted outcome is `exception_accepted`; it
  never edits Payment or declared receipt facts.
- The successful Daily Report pins the expected, declared, variance, outcome,
  and optional exception evidence.  A close replay returns that stored report
  unchanged.  Earlier Daily Reports remain readable with a null reconciliation
  snapshot.
- The existing unresolved-order and complete product-closeout gates are not
  weakened.  No new route is added.

## Exact implementation allowlist

1. `src/domains/operations/domain/types.ts`
2. `src/domains/operations/application/lifecycle-service.ts`
3. `src/domains/operations/infrastructure/lifecycle-repository.ts`
4. `src/web/statistics/page.ts`
5. `src/tests/lifecycle-api.integration.test.ts`
6. `tests/e2e/lifecycle.spec.ts`
7. `src/tests/architecture-guards.test.ts`

No eighth implementation path is authorized.

## Exclusions

- payment-provider or LINE Pay settlement, bank/merchant feeds, refunds, tax,
  printer, webhook, physical Inventory, deployment, or a second Payment
  authority;
- mutation of Payment, Order, Event-closeout, inventory, or historical Daily
  Report evidence during reconciliation;
- migration/schema, route, runtime-composition, Cost, Legacy, or broad UI
  redesign work.

## Acceptance and verification

- Exact Cash/LINE Pay matches close normally.  A per-method mismatch blocks
  without a close write; a confirmed, reasoned exception closes while retaining
  the exact mismatch.
- The closeout UI may present candidates and submit an explicit exception, but
  Operations re-computes all reconciliation facts on the server.
- A replay never re-evaluates later payment or receipt changes.  Existing
  unresolved-order, inventory-closeout, Payment, Kitchen, scheduled-pickup,
  and Daily-Report behavior remains intact.
- Architecture Guards protect the exact seven-path responsibility boundary and
  reject a simulated eighth substantive path with the same classifier.
- Run typecheck, lint, build, focused lifecycle API and E2E tests, Architecture
  Guards, `npm test`, `npm run verify`, `npm run verify:full`, compiled
  collection, `git diff --check`, text-hygiene, and scope audits.
