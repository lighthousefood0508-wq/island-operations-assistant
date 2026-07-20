# Order Integration Points

## Interface permissions

| Interface | May do | Must not do |
| --- | --- | --- |
| Admin | Read all, authorised cancellation/manual correction | Edit historical item snapshots or bypass audit. |
| POS | Create onsite Order, confirm, initiate future payment, cancel within policy | Edit Catalog, BOM, Cost, or Kitchen state directly. |
| Kiosk | Submit one customer Order, read its submitted result | Set payment/production/order terminal state. |
| Preorder adapter | Submit reservation before Event deadline/quota | Change Event availability without Order service. |
| Kitchen | Read eligible confirmed Orders; set production transitions | Change price, items, payment, source, or availability. |

## Kitchen design

Confirmed eligible Orders enter `queued`; Kitchen changes `queued -> preparing -> ready`. POS/staff handles handoff `ready -> served`, then the Operations Order service marks commercial `completed` when pickup is complete. On reconnect, Kitchen reloads Operations orders whose production state is `queued`, `preparing`, or `ready`, then sends idempotent state-transition requests. No SSE behavior is designed here.

## Payment design

Payment is an Operations-internal record with independent state. Cash staff confirmation may record a `paid` payment in a later implementation; an unpaid confirmed POS order remains possible. A failed electronic payment does not automatically release a reservation or cancel an Order; the POS/Admin applies the defined cancellation policy.

## Sales Contract design

Recommended emission point: **Order `completed`**, because the Constitution defines Sales Contract after completed Order and this is the point after customer handoff. `paid` is too early (refund/cancellation remains possible); `served` is production/handoff evidence but may not represent final commercial closure. A unique `operations_sales_outbox.order_id` prevents duplicate emission. This phase does not implement the outbox, batch, or Cost import.
