# ADR-002: SQLite first

## Decision

Use SQLite for the v1 modular monolith and isolate SQL migrations from business code.

## Rationale

It is low-cost, simple to back up, suitable for one small restaurant operation, and supports a later PostgreSQL migration when concurrency or multi-tenant scale demands it.

## Consequence

Writes must remain short transactions. Node's built-in `node:sqlite` is convenient for the foundation but must be re-evaluated for production support before VPS launch.
