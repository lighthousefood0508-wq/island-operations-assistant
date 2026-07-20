# ADR-017: Human-readable Order Number

Status: Proposed. Awaiting Architecture Owner Review.

Orders have immutable machine `orderId` plus Event-scoped, monotonic human `orderNumber`. Cancelled numbers are never reused; allocation must be transactional and concurrency-safe.
