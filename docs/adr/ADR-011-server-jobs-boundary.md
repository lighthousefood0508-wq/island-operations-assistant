# ADR-011: Server Jobs Are Coordinators Only

## Decision

Scheduling and batch coordination live only in `src/server/jobs/`. A job triggers an application service and records its result; it never executes SQL, accesses a repository, queries a Domain table, or contains business rules.

## Rationale

Jobs often become a shortcut around ownership boundaries. Keeping them as thin coordinators preserves the same application and repository rules used by interactive requests.

## Consequence

The future daily Sales Contract import is a Cost application service invoked by a thin server job. No job is implemented in Phase 1A.
