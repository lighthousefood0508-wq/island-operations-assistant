# Order Idempotency Policy

This policy is frozen for all three sources.

- Kiosk creates one UUID before submit and retains it through retry.
- Preorder uses a stable key derived or persisted from the source webhook event.
- POS creates one terminal key when staff begins an Order and reuses it for retry.

The Operations service records source, Event, idempotency key, and canonical payload fingerprint in the same transaction as quantity and Order creation.

| Request | Required response |
| --- | --- |
| New key, valid payload | Create exactly one Order and one quantity change. |
| Same key, same canonical payload | Return original Order; never change quantity again. |
| Same key, different payload | Return `409 idempotency_conflict`; change nothing. |
| Network timeout / retry | Same key returns original result. |
| Kiosk double tap | UI may disable submit, but server policy is final protection. |
| Preorder webhook retry | Same source key returns original result. |

Canonical payload includes Event, source, product version IDs, quantities, and normalized fields that alter the Order. Raw JSON text is insufficient because property order can differ. Idempotency retention duration remains an open privacy/operations decision.
