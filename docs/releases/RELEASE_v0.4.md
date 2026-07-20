# ROS v0.4

Status: Released locally on 2026-07-20. Git tag: `v0.4-order-core`.

## Architecture Status

ROS is an isolated, SQLite-first restaurant operating system. Catalog is a small Admin-owned master; Operations and Cost retain separate ownership boundaries in one SQLite database. This release implements Catalog and Operations foundations only. Legacy is not imported or modified.

## Governance Status

All implemented scope has an Architecture Owner record in `docs/DECISIONS.md`. Phase 1C Order Core is **DECISIONS #004**. Every later implementation report must cite its decision record first. Frozen contracts and accepted ADRs remain unchanged.

## Contracts and ADRs

Product Contract v2 and Sales Contract v1 are frozen. ADR-001 through ADR-013 establish the platform, domain boundaries, and Event snapshot policy. ADR-014 through ADR-018 freeze the Order policy; v0.4 implements only the approved POS subset without changing those ADRs.

## Completed Features

- Phase 0: isolated ROS repository, service shell, SQLite migration runner, health endpoint, and UI shells.
- Phase 0.5: Constitution v2 alignment, Catalog/Operations/Cost guards, database adapter, and contract validation.
- Phase 1A: Catalog Admin, immutable product versions, published Product Contract, and read-only POS proof.
- Phase 1B / 1B.1: Event Admin, one OPEN Event, Event Product Contract snapshot freeze, and sellable quantity.
- Phase 1C: POS-only Order create/read API, immutable item snapshots, Event-local order numbers, idempotency, audit logging, and atomic sellable quantity deduction.

## Known Gaps

There is no POS ordering UI in this release. Payment, Kitchen, Kiosk, Preorder, cancellation/refund, Sales Contract emission, Cost/BOM, authentication, external integrations, background jobs, and Legacy migration are not implemented.

## Migration History and Database Version

`001_initial_foundation.sql`, `002_catalog_phase_1a.sql`, `003_operations_events_phase_1b.sql`, and `004_order_core.sql` apply in sequence. Database version is migration `004_order_core.sql`.

## Acceptance and Verification

Phase 1B has a five-minute manual checklist and isolated Playwright coverage for Catalog to Event to POS, including Event close behavior. Phase 1C verifies rollback, idempotency, snapshots, validation, and a two-request final-portion race. `verify:full` passed with 27 unit/integration tests, architecture guards, migration smoke, and 4 Playwright scenarios.

## Future Roadmap

Phase 1C.1 may add only the approved POS minimal cart UI. No later phase begins without a new Architecture Owner decision.
