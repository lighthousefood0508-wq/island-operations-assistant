# Legacy Features to Rebuild in ROS

Approval: DECISIONS #020. This is a parity backlog, not an implementation authorization.

## P0: before a staff-facing ROS POS replaces Legacy

1. POS UI completion around existing central Order API: category menu, product cards, cart totals, optional customer identity, order note/item note, clear submission states and human order number.
2. Accepted central Kitchen UI: read only the OPEN Event, write only `productionStatus`, and expose queued/preparing/ready/served to POS through REST plus SSE/polling.
3. Central Order list with staff-safe combined workflow wording while preserving `orderStatus`, `paymentStatus`, and `productionStatus` separately.
4. Central Statistics/Closeout: order count, sold/remaining quantities, book total, manual actual receipts, difference, notes, audit and formal Event Close.
5. Event lifecycle UI: draft Event, safe sellable allocation, open, close, and explicit new Event setup.

## P1: requires policy/design plus a dedicated approved phase

1. Payment: cash and LINE Pay recording, payment state transitions, reversals/refunds and completion rule.
2. Safe staff amendment/cancellation of central Orders with atomic sellable-quantity deltas and append-only audit.
3. Customer Kiosk: direct central Order creation, 10-minute reservation lifecycle and retry/idempotency.
4. Preorder: deadline, quotas, customer data, direct sold allocation, manual Kitchen queue and customer change/cancel policy.
5. Reservation/appointment experience: pickup slots, due list, staff actions and source-specific rules.
6. Catalog UI parity: short name, customer display name/description, channels, publication and safe future-Event behavior.
7. Invoice-request capture after Architecture Owner selects Order extension or a separate Invoice domain.
8. Waste/remaining-record workflow after Operations/Cost and Contract ownership is approved.

## P2: presentation and operator convenience

1. Browser speech for remaining products, pending production and timed reminders.
2. Voice toggles and reminder configuration.
3. Read-only customer feedback capture and admin review, if approved as a bounded feature.
4. Printable or richer historical order screens.

## Future: after Operations and Cost are independently ready

1. BOM, ingredients, purchases, cost calculation and gross profit.
2. Waste Contract/reporting for food consumed after production begins.
3. Google Sheets export based on formal Operations records/Sales Contract, not browser data.
4. LINE/n8n automation and receipt processing.

## Explicitly not a rebuild target

Legacy's browser-owned order sequence, product state, inventory calculation, local “new day” reset, JSON customer-order queue, and frontend Google Sheet sync are mechanisms, not features. Their ROS replacements are listed in [LEGACY_MECHANISMS_RETIRED.md](LEGACY_MECHANISMS_RETIRED.md).
