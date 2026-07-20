# ADR-005: Google Sheets is reporting and review only

## Decision

Google Sheets is downstream for exports, reports, and human review. It is not used for real-time order or inventory state.

## Rationale

Sheets is valuable operationally but lacks transactional guarantees and cross-device event semantics.

## Consequence

Sync failures are retryable jobs and cannot block a completed restaurant transaction.
