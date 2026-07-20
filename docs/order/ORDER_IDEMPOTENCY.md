# Order Idempotency Strategy

## Key ownership

- Kiosk client creates a UUID before the first submit and retains it through retry.
- Preorder adapter derives or persists a stable key from the LINE webhook event ID plus source scope.
- POS terminal creates a UUID when the staff begins a new order; retry uses that same key.

The server stores `idempotencyKey`, source, Event, and a canonical payload fingerprint with the created Order. The unique scope should be `source + idempotencyKey`; a key is not reusable for another Event or payload.

## Required behavior

| Request | Server response |
| --- | --- |
| New key, valid payload | Atomically create one Order and reservation/allocation. |
| Same key, same canonical payload | Return the original Order result; do not reserve again. |
| Same key, different payload | Return `409 idempotency_conflict`; do not mutate anything. |
| Network timeout then client retry | Same key returns original result. |
| LINE webhook retry | Same webhook-derived key returns original result. |
| Kiosk double tap | UI disables submit, but server idempotency is the final protection. |

Canonical payload must include Event, source, product version IDs, quantities, customer/pickup fields that affect the Order, and notes after normalization. It must not use a raw JSON string whose property order can vary.

Recommended retention is 90 days after Order terminal state, subject to Owner approval and privacy policy. Never delete a key while the associated Order can still be retried by its source.
