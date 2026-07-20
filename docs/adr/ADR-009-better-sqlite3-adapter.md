# ADR-009: better-sqlite3 Behind a Database Adapter

## Decision

Replace the experimental Node SQLite module with `better-sqlite3`, isolated inside `src/shared/database/`. Domains and repositories depend on `DatabaseAdapter`, not the driver.

## Rationale

The adapter gives a stable synchronous SQLite foundation without an ORM, removes the experimental runtime warning, and keeps a future driver replacement localized.

## Consequence

The adapter configures foreign keys, WAL mode, and a 5-second busy timeout. Driver imports are forbidden outside shared database infrastructure.
