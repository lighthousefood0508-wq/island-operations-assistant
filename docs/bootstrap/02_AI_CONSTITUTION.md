# AI Constitution Companion

This is a practical AI onboarding companion to the repository's real constitution. `CONSTITUTION.md` is the highest architecture rule. Accepted ADRs and explicit Architecture Owner Decisions come next, followed by `AGENTS.md`.

Every AI contributor must follow this guide, but it cannot override those higher-priority sources.

## Authority

1. Architecture Owner decisions override AI suggestions.
2. If a Decision record conflicts with an AI preference, the Decision record wins.
3. If a change requires architecture interpretation, stop and ask the Architecture Owner.
4. Never start the next phase automatically from a prior report, roadmap, or completed task.

## No Duplicate Systems

Never create duplicate versions of existing logic.

Prohibited without explicit approval:

- Duplicate APIs
- Duplicate application services
- Duplicate repositories
- Duplicate data models
- Duplicate state machines
- Duplicate UI workflows for the same job
- Duplicate event close paths
- Duplicate product publish paths

Do not create files or concepts named like:

- v2
- new
- final
- temp
- backup
- copy
- old
- rewrite

unless the Architecture Owner explicitly approves coexistence.

## Domain Boundaries

1. Never merge Catalog and Operations.
2. Never move Operations data into Catalog for UI convenience.
3. Never move Catalog product-master concerns into Operations.
4. Never modify domain boundaries without approval.
5. Never query or write another domain's internal tables.
6. Never import another domain's internal implementation.

## Product Contract

Never bypass Product Contract.

Operations may use published product snapshots but must not reach into Catalog internals for live product data during event operation.

Product Contract must not contain:

- BOM
- Ingredients
- Cost
- Purchase data
- Cost inventory

## Business Rules

Every business-rule change requires approval.

Business rules include:

- Event open and close policy
- Single OPEN Event rule
- Sellable inventory calculation
- Safety buffer
- Reservation quantity
- Order number generation
- Order status transitions
- Payment rules
- Kitchen production status
- No-show policy
- Inventory release
- Audit requirements

Do not hide a business-rule change inside a UI or test change.

## UI Rules

UI follows operator workflow, not code structure.

Operating efficiency is more important than visual beauty.

POS exists for fast ordering only. Back Office exists for setup, inspection, links, health, and management.

Do not add back-office information to POS unless it directly helps the cashier finish an order faster.

## Hidden Architecture Changes

Never perform hidden architecture changes.

Examples of hidden architecture changes:

- Adding a new API to avoid using an existing service
- Writing directly to SQLite from UI code
- Adding a new data source because current data is inconvenient
- Letting localStorage become an official source of truth
- Changing contract shape without a Decision
- Recomputing domain state in read models

## Required Stop Conditions

Stop before implementation if the change may require:

- Domain changes
- Contract changes
- API changes
- Schema or migration changes
- Business-rule changes
- Product Contract changes
- Cross-domain reads or writes
- Legacy modification
- Payment, Cost, Customer, Preorder, LINE, n8n, AI, or external integration work outside approved scope

## Rule Summary

```text
Decision first.
Domain owner first.
Existing logic first.
Operator workflow first.
No duplicate systems.
No hidden architecture changes.
```
