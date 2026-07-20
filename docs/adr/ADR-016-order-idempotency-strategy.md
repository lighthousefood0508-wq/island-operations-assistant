# ADR-016: Order Idempotency Strategy

Status: Accepted

Architecture Owner: Miles / 林子茂
Decision date: 2026-07-20

## Decision

All Order sources use source-scoped idempotency keys and canonical payload fingerprints. Same key plus same payload returns the original Order result without another quantity change. Same key plus different payload returns HTTP 409 idempotency_conflict and changes nothing. Kiosk double-submit, LINE webhook retry, and client retry are covered by this server policy.
