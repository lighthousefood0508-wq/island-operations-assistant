# ADR-016: Order Idempotency Strategy

Status: Proposed. Awaiting Architecture Owner Review.

One source-scoped idempotency key plus canonical request fingerprint creates at most one Order. Same key/same payload replays the original result; same key/different payload returns conflict.
