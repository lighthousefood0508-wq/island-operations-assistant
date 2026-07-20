# ADR-015: Sellable Quantity Reservation Lifecycle

Status: Accepted

Architecture Owner: Miles / 林子茂
Decision date: 2026-07-20

## Decision

- POS directly increases soldQuantity; it never uses reservation.
- Kiosk increases reservedQuantity for 10 minutes. Payment success converts reserved to sold; timeout releases reserved.
- Preorder validates Event, deadline, quota, and availability then directly increases soldQuantity; it never uses reservation.
- Cancellation before preparing restores the appropriate reservation or sold allocation.
- Cancellation at preparing, ready, or served never restores sold allocation and must be audited with actor, time, and reason.
- Number allocation, idempotency, Order creation, and every counter change occur in one transaction and must preserve non-negative remaining quantity.
