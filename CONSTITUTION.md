# Desert Island ROS Architecture Constitution v2

This document is the highest architecture rule for ROS. It overrides earlier architecture documents if they conflict.

## Two business domains and one small catalog

1. **Operations** owns orders, order items, payments, kitchen progression, events, reservations, availability, and published-product copies.
2. **Cost** owns ingredients, aliases, unit conversions, BOMs, purchases, inventory movements, cost calculation, and future production/waste records. BOM belongs only to Cost.
3. **Catalog** is a deliberately small Admin-owned product master, not an equal business domain. It owns categories, product versions, channel settings, and publishing status only.

## Storage and ownership

- Phase 0.5 uses one SQLite database with strict table prefixes: `catalog_*`, `operations_*`, and `cost_*`.
- Operations must never query or write `cost_*` tables. Cost must never query or write `operations_*` tables.
- Catalog must never handle orders, payments, BOMs, inventory, or cost calculations.
- Admin is the only Catalog writer. POS and Kitchen cannot write product data and cannot receive BOM data.
- A new feature must identify its owner before work begins. If it cannot be classified as Operations, Cost, or the small Catalog master, stop and ask the Architecture Owner.

## Frozen cross-domain contracts

The only cross-domain interfaces are `Product Contract v1` and `Sales Contract v1`.

- Product Contract publishes safe product information from Catalog for Operations and Cost. It never contains BOM, ingredients, costs, inventory, or purchases.
- Sales Contract is created only by Operations after a completed order. It is stored in `operations_sales_outbox` and imported by Cost once per day into `cost_sales_imports` using `salesEventId` for idempotency.
- Cost never reads an Operations order table, and Operations never receives Cost's deduction result.
- Before modifying any file under `src/shared/contracts/`, stop and obtain explicit approval from the Architecture Owner.

## Jobs and batch coordination

- Schedulers and batch coordinators live only under `src/server/jobs/`.
- A job may trigger work, coordinate timing, call an application service, and record a job result.
- A job must not execute SQL, access a repository, query a Domain table, contain business rules, or operate another Domain directly.
- The allowed path is `server/jobs -> domain application service -> repository -> database`.
- Any future daily Sales Contract batch follows this rule. Phase 1A creates no scheduled or batch job.

## Explicitly prohibited in this phase

Kafka, RabbitMQ, message queues, CQRS, microservices, complex event buses, real-time Sales Contract delivery, additional business domains, Google Sheets as a source database, Legacy integration, and production credentials.

Architecture Owner: Miles / 林子茂
