# Frozen Order Policy Acceptance Criteria

Future implementation must demonstrate all of these without changing this policy:

1. POS creates `confirmed` and directly increases sold quantity.
2. Kiosk creates `submitted` and reserves for exactly 10 minutes.
3. Kiosk timeout releases reserved quantity, records `timeout`, and does not reuse the number.
4. Kiosk payment converts reserved to sold, confirms, pays, and queues.
5. Preorder validates Event, deadline, preorder quota, and sellable quantity; success is immediately confirmed and sold.
6. Unpaid Preorder never auto-enters Kitchen; POS can manually queue it.
7. All sources consume the one Event `{eventCode}-{sequence}` sequence.
8. Cancellation before `preparing` restores the applicable allocation.
9. Cancellation at `preparing`, `ready`, or `served` does not restore sold and requires actor/time/reason/audit.
10. `completed` requires paid plus served and only then emits one Sales Contract.
11. Cancelled Orders never emit Sales Contract.
12. Same idempotency key and same payload never duplicate Order or quantity; same key and differing payload returns `409`.
13. Every quantity transaction preserves `remainingQuantity >= 0` and rejects oversell.
14. Kitchen changes production state only; it cannot modify Order, payment, price, items, or quantity.
