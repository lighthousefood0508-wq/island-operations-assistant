# Retired Legacy Mechanisms

Approval: DECISIONS #020. These mechanisms are deliberately not eligible for migration into ROS.

| Retired Legacy mechanism | Legacy evidence | Why it is retired | ROS replacement |
| --- | --- | --- | --- |
| Browser `localStorage` as POS order/product/reservation database | `pos-app/app.js:216-371` | Each browser owns a different truth; browser reset/loss breaks operations. | Central SQLite through Operations application services and REST APIs. |
| Browser `storage` event as cross-device synchronization | `app.js:2277-2285` | It only reaches compatible pages sharing one browser origin/storage context, not a reliable multi-device topology. | SSE notification plus REST re-fetch and polling fallback. |
| Browser-derived remaining calculation | `app.js:849-874`; `kitchen.js:102-123` | Different pages count different collections; concurrent devices can oversell. | Transactional `operations_sellable_inventory` counters and server validation. |
| Per-browser order sequence | `app.js:956-984` | Concurrent terminals can duplicate/reorder numbers. | Event-scoped transactional order sequence, ADR-017. |
| `customer-orders.json` as customer-order queue | `pos-app/server.js:10,149-163,345-383` | File writes are not an Operations transaction and do not share lifecycle/audit semantics. | Future Kiosk/Preorder creation through the central Order service and idempotency, ADR-015/016. |
| `customer-menu.json` as public catalog | `server.js:12,183-195,296-328` | Menu can diverge from POS and has no Event snapshot policy. | Catalog publication -> Product Contract v2 -> Operations Event snapshot, ADR-013. |
| Frontend status mutation/deletion | `app.js:1230-1337` | Skips authorization, lifecycle validation, audit and central quantity handling. | Operations lifecycle service; Kitchen only writes production state. ADR-014/015. |
| Local closeout/new-day reset | `app.js:1356-1423` | Clears the working truth in a browser and mixes reporting with destructive reset. | Idempotent Operations Event Close plus immutable daily snapshot and new Event setup. |
| Mutable product cost/BOM in POS | `app.js:1769-1970` | Exposes Cost data to POS and lets a sales surface rewrite cost history. | Cost domain owns BOM/cost; Product Contract excludes both. |
| Frontend Google Sheet sync | `app.js:578-784` | Browser retries and status flags cannot guarantee durable export or correct sales emission time. | Future Operations export/Sales Contract after completed, ADR-018; Sheets is output only. |
| Kiosk reserve buffer of one item | `customer.js:206-226` | A UI-only buffer is not a reservation lifecycle. | Central `reservedQuantity` with approved timeout policy, ADR-015. |
| Polling JSON as the only feedback/order coordination | `app.js:1006-1041`, 10-second interval | Stale pages can display inconsistent data and it bypasses formal domain records. | Central API, SSE change notification, then re-fetch; polling is fallback only. |
