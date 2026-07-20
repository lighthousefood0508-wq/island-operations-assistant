# Order Domain Open Questions

These require Architecture Owner or business-owner decision before implementation. They are intentionally not decided by this design package.

1. What exact Kiosk reservation timeout should apply: 10, 15, or another number of minutes?
2. Does Kiosk submission require staff confirmation, payment confirmation, or immediate confirmation before Kitchen can queue it?
3. For Preorder, is successful submission automatically confirmed, or must staff approve it? What exact Event deadline and per-product/preorder quota rules apply?
4. Can a customer cancel a preorder themselves, and until what deadline?
5. After `preparing` or `ready`, may staff restore sellable quantity when food is demonstrably not made, or is restoration always forbidden without a later waste workflow?
6. Is an unpaid but confirmed POS order allowed to reach Kitchen, or must cash/electronic payment succeed first?
7. What customer contact data is permitted, how long is it retained, and who may view it?
8. Is 90-day idempotency-key retention acceptable, or should retention follow another operational/privacy policy?
9. Should Event order numbers be one shared queue for all sources, or should preorder have a distinct human-facing numbering convention while retaining one central sequence?
10. Who may issue a partial/full refund, and does every refund require a manager reason code?
11. Is `completed` always set at `served`, or can POS close it later as an end-of-service reconciliation step?

No Phase 1C implementation begins until these are reviewed or explicitly deferred with a bounded first-version rule.
