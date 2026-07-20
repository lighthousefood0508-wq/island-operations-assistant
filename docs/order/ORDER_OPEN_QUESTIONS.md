# Order Policy Open Questions

## Resolved by Architecture Owner, 2026-07-20

- One Event-wide order-number sequence for POS, Kiosk, and Preorder.
- POS direct confirmation and direct sold allocation; unpaid POS does not enter Kitchen.
- Kiosk reserves for 10 minutes, needs no manual acceptance, and pays to confirm/queue.
- Preorder automatically confirms, directly allocates sold quantity, and is manually queued by POS.
- Cancellation after production begins never restores sold quantity.

## Still requiring Architecture Owner decision

1. Which Admin-owned Event field defines Preorder deadline, and how is its timezone displayed and validated?
2. What is the exact per-Event/per-product Preorder quota model, and how does it interact with shared sellable quantity?
3. After `served`, does POS always manually mark `completed`, or can a future approved flow do it automatically?
4. Is partial refund included in v1, and which role may issue partial/full refunds?
5. What approved mechanism triggers the ten-minute Kiosk timeout: staff action, future scheduler, or another Operations job?
6. Can a Preorder customer modify or cancel, and what cutoff policy applies?
7. What minimum customer contact data and retention period are permitted?
8. What idempotency-key retention period satisfies operational and privacy needs?

No Phase 1C implementation may choose these implicitly.
