# ADR-001: Server-side SQLite is the single source of truth

## Decision

ROS owns live business records in SQLite. Clients keep only ephemeral display/cache state. Google Sheets receives reporting sync.

## Rationale

This removes cross-device divergence caused by independent browser storage and makes transactions, audit, and rollback possible.

## Consequence

All writes must be server APIs and clients must recover from reconnect by fetching state.
