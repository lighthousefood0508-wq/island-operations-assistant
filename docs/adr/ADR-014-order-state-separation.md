# ADR-014: Order State Separation

Status: Accepted

Architecture Owner: Miles / 林子茂
Decision date: 2026-07-20

## Decision

Orders use three independent fields: orderStatus, paymentStatus, and productionStatus.

- orderStatus: draft, submitted, confirmed, completed, cancelled
- paymentStatus: unpaid, pending, paid, failed, partially_refunded, refunded
- productionStatus: not_started, queued, preparing, ready, served, cancelled

They must never be merged into one large status. Payment never automatically completes an Order. Production never determines payment. POS/staff alone may mark completed, and only after payment is paid and production is served.
