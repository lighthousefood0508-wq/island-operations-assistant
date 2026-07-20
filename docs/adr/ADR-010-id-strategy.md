# ADR-010: Prefixed Random UUID IDs

## Decision

All new ROS records use immutable IDs created with Node `randomUUID()` and a human-readable type prefix, such as `cat_`, `prod_`, and `pver_`.

## Rationale

Random UUIDs are mature, independent of mutable names, safe across local creation contexts, and simple for a single SQLite deployment. Prefixes improve support and log readability without becoming business identity.

## Consequence

Names and category codes are never primary keys. IDs do not encode product names or business meaning.
