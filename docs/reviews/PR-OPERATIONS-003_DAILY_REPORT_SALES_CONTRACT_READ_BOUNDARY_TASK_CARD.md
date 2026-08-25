# PR-OPERATIONS-003 — Daily Report / Sales Contract Read Boundary

## Constitution Compatibility Gate

- **Reviewed authority**: Constitution v3 Operations ownership; DECISIONS #007
  Event Close/Daily Report, #012 authoritative client-reported Payment evidence,
  #013 closeout evidence, #087 scheduled pickup, #088 payment/closeout
  reconciliation, and DECISIONS #089.
- **Compatibility result**: PASS.  The work publishes a read-only Operations
  contract over already immutable Event-close evidence.  It neither creates a
  second Sales Contract authority nor changes any lifecycle, payment, or
  closeout rule.

## Single responsibility

Expose deterministic list and identity reads for the immutable Daily Reports
already created at Event Close, suitable for operational reporting and a later
export consumer.  The boundary is evidence retrieval, not report generation,
reconciliation, settlement, or an analytics product.

## Evidence contract

- The sole historical source is the stored `daily_report_json` in
  `operations_event_closures`.  Reads must not join mutable Orders, Payments,
  Event configuration, Products, inventory, or closeout declarations to
  reconstruct a closed report.
- `GET /api/admin/operations/daily-reports` returns immutable report summaries
  ordered by `closedAt` descending and `event.eventId` ascending.  A summary
  retains the stored Event facts, Order counts, payment totals, reconciliation
  snapshot, and close instant.
- `GET /api/admin/operations/daily-reports/:eventId` returns the complete
  stored `DailyReport`.  The existing
  `GET /api/events/:eventId/daily-report` remains compatible and delegates to
  the same governed read coordinator.
- `paymentReconciliation: null` on older reports is historical evidence, not a
  missing value to recompute.  For newer reports, expected, declared,
  variance, outcome, and optional accepted-exception evidence remain exactly
  as captured.  Client-reported payment-method totals are not settlement or
  provider truth.

## Application and safety boundary

- Operations owns a narrow public Daily Report evidence read port.  Its
  Application service accepts only nonblank governed Event identities and
  orchestrates list/get outcomes; it owns no Event Close, Payment, sales,
  reconciliation, or persistence authority.
- The Operations SQLite lifecycle adapter reconstructs only the immutable
  stored report representation and performs no writes.  Technical or malformed
  stored-evidence failures cross the Application/HTTP boundary only as a safe
  typed `daily_report_read_failed` 500 response.  Missing evidence is
  `daily_report_not_found` 404; malformed identity is
  `daily_report_identity_invalid` 422.
- Routes are delegation-only and `src/server/index.ts` is the sole production
  composition site.  Responses must not contain SQLite, table, query, stack,
  cause, or raw persistence messages.

## Exact implementation allowlist (11 paths)

1. `src/domains/operations/domain/daily-report-read-port.ts`
2. `src/domains/operations/application/daily-report-read-service.ts`
3. `src/domains/operations/application/daily-report-read-errors.ts`
4. `src/domains/operations/infrastructure/lifecycle-repository.ts`
5. `src/domains/operations/index.ts`
6. `src/server/app/routes.ts`
7. `src/server/index.ts`
8. `src/tests/daily-report-read-application.test.ts`
9. `src/tests/daily-report-read-persistence.integration.test.ts`
10. `src/tests/daily-report-read-api.integration.test.ts`
11. `src/tests/architecture-guards.test.ts`

No twelfth implementation path is authorized.

## Acceptance criteria

- Closed reports list deterministically from stored immutable evidence; an
  empty collection is a successful empty result.
- Identity reads preserve complete Daily Report, payment-method, and
  reconciliation evidence exactly, including null historical reconciliation.
- Mutating a live row after close cannot alter returned historical evidence.
- Invalid identity, missing report, malformed stored report, and technical
  read failures return safe typed failures without writes or raw detail.
- The existing Event-scoped Daily Report endpoint remains compatible and no
  write/lifecycle endpoint changes behavior.
- Architecture Guards protect the exact eleven-path substantive responsibility
  boundary and reject a simulated twelfth responsibility path through the same
  classifier.

## Explicit exclusions

- Event, Order, Payment, closeout, reconciliation, audit, inventory, Product,
  Sales Contract write, Cost, UI/navigation, export system, advanced Analytics,
  payment provider, tax/accounting, inventory, printer, webhook, migration,
  schema, package, deployment, and Legacy work;
- historical recomputation, revaluation, correction, settlement, mutable live
  state substitution, or a second reporting authority.

## Required verification

- Focused Daily Report Application, persistence, and API tests, including
  deterministic ordering, immutable complete evidence, historical null
  reconciliation, safe typed failures, and zero-write behavior.
- Operations Event/Order/Payment/closeout/reconciliation, scheduled-pickup,
  and Daily Report non-regression; full E2E; Architecture Guards; typecheck,
  lint, build, `npm test`, `npm run verify`, `npm run verify:full`, compiled
  collection, `git diff --check`, exact 11-path audit, UTF-8, final-newline,
  and trailing-whitespace checks.

## Stop conditions

Stop for a required twelfth path, a migration/schema/package/UI/Cost/export
expansion, a change to Event/Order/Payment/closeout/reconciliation semantics,
a public persistence boundary expansion, or any new Architecture Decision.
