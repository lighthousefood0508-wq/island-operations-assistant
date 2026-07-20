# Changelog

## 2026-07-20 - Phase 1B Event and Sellable Inventory

- Added Product Contract v2 with approved category display snapshots and runtime validation.
- Added Operations-owned Events, single OPEN Event enforcement, sellable inventory allocation, and remaining quantity calculation.
- Added Event Admin, current Event public APIs, and event-scoped read-only POS display.
- Added unit, API integration, and UI E2E coverage. No orders, payments, Kitchen, Customer, Cost, or external integration was added.

## 2026-07-20 - Phase 1A E2E acceptance

- Added isolated Playwright Chromium acceptance tests for Admin publish to read-only POS.
- Added negative UI coverage for missing POS name, price, channels, inactive categories, unpublished products, and kiosk-only products.
- Added `test:e2e`, `verify:full`, ignored HTML/failure artifacts, and the five-minute manual acceptance checklist.
- Corrected draft saving so incomplete drafts can be stored and publication performs the required validation.

## 2026-07-20 - Phase 1A Catalog Admin

- Replaced the experimental SQLite runtime with `better-sqlite3` behind a Database Adapter.
- Added Catalog categories, editable product drafts, immutable published versions, channels, audit records, public Product Contract API, minimal Admin, and read-only POS display.
- Added adapter, Catalog, and publish-to-POS integration tests. No Operations or Cost behavior was implemented.

## 2026-07-20 - Phase 0.5 Constitution v2 alignment

- Added the controlling `CONSTITUTION.md` and Architecture Owner approval rule.
- Replaced the initial business schema with strict Catalog, Operations, and Cost prefixes.
- Moved BOM ownership exclusively to Cost and defined Product/Sales Contract v1.
- Added runtime validation, contract tests, SQL/import/prefix/infrastructure guard tests, and migration smoke verification.
- Added ADR-007 and ADR-008. No Phase 1 feature or legacy integration was started.

## 2026-07-19 - Phase 0 foundation

- Created isolated `desert-island-ros` Git repository.
- Added Node.js/TypeScript service shell, SQLite migration runner, and initial domain schema.
- Added health endpoint, SSE heartbeat, and four non-business UI shells.
- Added environment template, test, architecture documents, roadmap, decisions, legacy audit boundary, and six ADRs.
- Did not modify or import from the legacy project.
