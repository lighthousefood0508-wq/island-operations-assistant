# Order Domain Design Acceptance Criteria

Architecture Review should confirm all of the following before Phase 1C Implementation is considered:

1. Orders are Operations-owned; no fourth domain is introduced.
2. POS, Kiosk, and Preorder use one Order model with explicit source-specific creation rules.
3. Order, Payment, and Production states are separate.
4. Event Product Contract v2 snapshots provide all item name/category/price data; Catalog cannot rewrite history.
5. Quantity changes are atomic and guarded against oversell.
6. `submitted` reservation, `confirmed` sold allocation, cancellation, timeout, and post-production policies are explicit.
7. Idempotency handles double tap, webhook retry, and client retry with same-key replay and different-payload conflict behavior.
8. Human-readable number allocation is Event-scoped, concurrent-safe, and never reused after cancellation.
9. Kitchen can change only production state through Operations.
10. Payment and refund never imply Order completion or quantity restoration automatically.
11. Sales Contract emits once at the approved completed-order point, not during payment or Kitchen state changes.
12. All unresolved business policy choices appear in [ORDER_OPEN_QUESTIONS.md](ORDER_OPEN_QUESTIONS.md).
