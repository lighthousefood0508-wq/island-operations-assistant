# ADR-017: Human-readable Order Number

Status: Accepted

Architecture Owner: Miles / 林子茂
Decision date: 2026-07-20

## Decision

Every Event has one shared sequence for POS, Kiosk, and Preorder. The format is eventCode-sequence, beginning at 001 for each Event. orderId remains the immutable system identifier. Cancellation never reuses a number, and number allocation must be transactional and concurrency-safe.
