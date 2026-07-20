# ADR-007: Two Domain Contract Boundaries

## Decision

ROS has two major business domains: Operations and Cost. Catalog remains a small Admin-owned product master. A single SQLite database is allowed in v1 only with `catalog_*`, `operations_*`, and `cost_*` boundaries enforced by automated tests.

## Rationale

Restaurant operations and cost/inventory change at different rates. Ownership boundaries prevent an operational change from casually modifying cost rules, while avoiding premature multi-database synchronization.

## Consequence

No domain may query another domain's tables or internal implementation. Product Contract and Sales Contract are the only interfaces.
